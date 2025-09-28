from io import StringIO
from typing import List

import xmltodict
import os
import re
import pandas as pd
from fastapi import UploadFile
import logging

from services.file_manager.file_manager_service_abstract import FileManagerServiceAbstract
from services.trace_extractor import TraceExtractor
from util.datastructure import flat_map
from util.path import path_to_class


class CoverageProcessor:
    logger = logging.getLogger(__name__)

    INDEX_FILE_NAME = "index.html"

    def __init__(self, file_manager_service: FileManagerServiceAbstract, trace_extractor_service: TraceExtractor):
        self.file_manager_service = file_manager_service
        self.trace_extractor_service = trace_extractor_service

    async def read_line_coverage_report(self, file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            xml_dict = xmltodict.parse(f.read())
        return xml_dict

    async def list_index_file(self, files: List[UploadFile]):
        return list(filter(lambda x: x.filename.endswith(self.INDEX_FILE_NAME) and "report" in x.filename, files))

    async def process_html_file(self, file: UploadFile):
        required_columns = {'Name', 'Line Coverage', 'Mutation Coverage'}

        # Read file and decode to string
        html_bytes = await file.read()
        html_str = html_bytes.decode("utf-8")

        # Use StringIO instead of passing raw string
        data = pd.read_html(StringIO(html_str))

        filtered_table = [table for table in data if required_columns.issubset(table.columns)]
        file_path = f"/{file.filename.removesuffix(f'/{self.INDEX_FILE_NAME}').split('/')[-1]}"

        return {"file_path": file_path, "table": filtered_table}

    def get_tree_from_table(self, file_path: str, table):
        result = []
        for _, row in table.iterrows():
            if not row["Name"].endswith(".java"):
                continue
            full_path = os.path.join(file_path.replace(".", "/"), row["Name"])
            line_coverage = self.extract_line_coverage(row["Line Coverage"])
            mutation_coverage = self.extract_mutation_coverage(row["Mutation Coverage"])
            data = {
                    "path": full_path,
                    "lines": line_coverage,
                    "mutations": mutation_coverage
            }
            result.append(data)
        return result

    def extract_line_coverage(seflf, line_coverage):
        match = re.search(r"(\d+)%\s+(\d+)/(\d+)", line_coverage)
        if not match:
            raise Exception(f"Line Coverage could not be extracted: {line_coverage}")
        return {
            "coverage": int(match.group(1)),
            "covered_line": int(match.group(2)),
            "total_line": int(match.group(3))
        }

    def extract_mutation_coverage(self, mutation_coverage):
        match = re.search(r"(\d+)%\s+(\d+)/(\d+)", mutation_coverage)
        if not match:
            raise Exception(f"Mutation Coverage could not be extracted: {mutation_coverage}")
        return {
            "coverage": int(match.group(1)),
            "killed": int(match.group(2)),
            "total_mutation": int(match.group(3)),
        }

    async def combine_trace_data(self, coverage_result, files, repo_name):
        block_data = self.trace_extractor_service.get_project_block_data(repo_name, files)
        # block_coverage_data = await self.trace_extractor_service.get_block_coverage(files)
        coverage_trace_result = []
        for row in coverage_result:
            path = row["path"]
            class_path = path_to_class(path)
            total_block = block_data[class_path]
            # total_trace = block_coverage_data[class_path] if class_path in block_coverage_data else 0
            data = {
                path: {
                    "lines": row["lines"],
                    "mutations": row["mutations"],
                    # "traces": {
                    #     "total_trace": 0,
                    #     "total_block": total_block,
                    #     "average": total_trace / total_block
                    # }
                    "traces": {
                        "total_trace": 100,
                        "total_block": total_block,
                        "average": 100
                    }
                },
            }
            coverage_trace_result.append(data)
        return coverage_trace_result

    async def process_coverage(self, files: List[UploadFile], repo_name):
        logging.info(f"Processing {len(files)} files")
        coverage_result = []
        index_file_list = await self.list_index_file(files)
        for index_file in index_file_list:
            process_data = await self.process_html_file(index_file)
            result = flat_map(lambda x: self.get_tree_from_table(process_data['file_path'], x), process_data['table'])
            coverage_result.extend(result)

        coverage_result = await self.combine_trace_data(coverage_result, files, repo_name)
        self.file_manager_service.save_complexity(repo_name, {"summary": coverage_result})
        return {
            "success": True,
        }