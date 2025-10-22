import logging
import os
import pprint
import re
from collections import defaultdict
from io import StringIO
from typing import List, Dict, Any, Tuple

import csv
import copy

import pandas as pd
import xmltodict
import json
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup
from fastapi import UploadFile

from configs.trace_config import TraceConfig
from lxml.html.defs import link_attrs
from repositories.trace_extractor_repository import TraceExtractorRepository


class DataExtractor:
    INDEX_FILE_NAME = "index.html"

    def __init__(self, trace_extractor_repository: TraceExtractorRepository, trace_config: TraceConfig):
        self.trace_extractor_repository = trace_extractor_repository

    async def get_block_coverage(self, files: List[UploadFile]):
        line_coverage_file = list(filter(lambda file: file.filename.endswith("linecoverage.xml"), files))
        if not line_coverage_file:
            return [{}, {}]

        test_result = {}
        coverage_result = {}
        for file in line_coverage_file:
            content = await file.read()
            parsed_data = xmltodict.parse(content)
            if not parsed_data or not parsed_data["coverage"] or not parsed_data["coverage"]["block"]:
                return [coverage_result, test_result]

            coverage_data = parsed_data["coverage"]["block"]
            for row in coverage_data:
                class_name, sub_class_name = self.extract_class_name(row["@classname"])
                tests = row["tests"]['test']
                if type(tests) != list:
                    tests = [tests]
                coverage_dict = {
                    "sub_class_name": sub_class_name,
                    "method_name_desc": row["@method"],
                    "block": row["@number"],
                    "tests": tests,
                    "found_match": False
                }
                test_set = set([t["@name"] for t in tests])
                if class_name not in coverage_result:
                    coverage_result[class_name] = [coverage_dict]
                    test_result[class_name] = test_set
                else:
                    coverage_result[class_name].append(coverage_dict)
                    test_result[class_name].update(test_set)
        return [coverage_result, test_result]


    async def get_mutation_block_data(self, files: List[UploadFile]):
        mutations_file = list(filter(lambda file: file.filename.endswith("mutations.xml"), files))

        if not mutations_file:
            return {}

        mutations_result = defaultdict(list)
        for file in mutations_file:
            content = await file.read()
            parsed_data = xmltodict.parse(content)
            if not parsed_data or not parsed_data["mutations"] or "mutation" not in  parsed_data["mutations"]:
                return mutations_result

            mutation_data = parsed_data["mutations"]["mutation"]
            for row in mutation_data:
                if not isinstance(row, dict):
                    continue
                if "block" not in row and "blocks" not in row:
                    continue
                class_name, sub_class_name = self.extract_class_name(row["mutatedClass"])
                mutation_dict = {
                    "sub_class_name": sub_class_name,
                    "status": row["@status"],
                    "number_of_tests": row["@numberOfTestsRun"] if "@numberOfTestsRun" in row else 0,
                    "method_name": row["mutatedMethod"],
                    "method_desc": row["methodDescription"],
                    "line_number": row["lineNumber"],
                    "mutator": row["mutator"],
                    "blocks": row["blocks"] if "blocks" in row else row["block"],
                    "description": row["description"],
                    "killingTest": row["killingTest"],
                }
                if class_name not in mutations_result:
                    mutations_result[class_name] = [mutation_dict]
                else:
                    mutations_result[class_name].append(mutation_dict)
        return mutations_result


    def get_project_block_data(self, project_name: str, module: str, compiledFiles: List[UploadFile], project_type: str = "maven"):
        logging.info("Total java .class file:" + str(len(compiledFiles)))
        block_data = self.trace_extractor_repository.extract_block_data(project_name, compiledFiles)
        result = {}
        if "data" not in block_data:
            print(module, len(compiledFiles), len(compiledFiles))
        for row in block_data["data"]:
            class_name, sub_class_name = self.extract_class_name(row["clazz"])
            block_info = {
                "sub_class_name": sub_class_name,
                "method_name": row["method"],
                "method_desc": row["methodDesc"],
                "line": row["line"],
                "block": row["block"],
                "is_line_cover": False,
                "tests": [],
            }
            if class_name not in result:
                result[class_name] = {
                    "module": module,
                    "block":[block_info]
                }
            else:
                result[class_name]["block"].append(block_info)
        return result

    def get_class_map(self, project_name, files: List[UploadFile]):
        java_files = [f for f in files if f.filename.endswith(".java")]

        if not java_files:
            logging.warning("No .java files found to upload.")
            return {}

        logging.info(f"Found {len(java_files)} Java files for project: {project_name}")

        # ✅ Call the class extractor uploader
        class_map = self.trace_extractor_repository.extract_class_map(project_name, java_files)

        logging.info(f"Extracted {len(class_map)} class mappings.")
        return class_map

    def extract_class_name(self, original_class_name):
        split_original_class_name = original_class_name.split(".")
        parent_path = ".".join(split_original_class_name[: -1])
        class_base_name = split_original_class_name[-1]
        if "$" in class_base_name:
            split_class_base_name = class_base_name.split("$", 1)
            class_name = f"{parent_path}.{split_class_base_name[0]}"
            sub_class_name = split_class_base_name[1]
        else:
            class_name = original_class_name
            sub_class_name = None
        return class_name, sub_class_name

    async def extract_html_files(self, files: List[UploadFile]):
        results = {
            "link_result": {},
        }

        for file in files:
            # only process .html PIT report files
            if not file.filename.endswith(".html") or file.filename.endswith("/index.html"):
                continue

            relative_path = file.filename
            class_path = ".".join(relative_path.split("pit-reports/")[-1].split("/"))
            class_path = class_path.split(".java.html")[0].split(".html")[0]

            if class_path not in results["link_result"]:
                results["link_result"][class_path] = {}
            link_result = await self.get_line_level_link(file)
            results["link_result"][class_path] = link_result
            file.file.seek(0)
        return results

    async def get_line_level_link(self, file):
        # read HTML
        file.file.seek(0)
        html = file.file.read()
        if isinstance(html, bytes):
            html = html.decode("utf-8", errors="ignore")
        soup = BeautifulSoup(html, "html.parser")
        # find all mutation rows (td.killed or td.survived)
        results = {}
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            text = a_tag.get_text(strip=True)
            if not text.isdigit():
                continue

            # Skip group anchors (mutation summary)
            if href.startswith("#group"):
                continue

            line_no = int(text)
            results[line_no] = href
        return results


if "__main__" == __name__:
    with open("/Users/nabhansuwanachote/Desktop/pit-reports/linecoverage.xml", "r", encoding="utf-8") as file:
        xml_string = file.read()

    # Convert XML to Python dictionary
    data_dict = xmltodict.parse(xml_string)

    trace = DataExtractor(data_dict)
