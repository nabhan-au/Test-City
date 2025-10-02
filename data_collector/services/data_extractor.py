import logging
import pprint
from collections import defaultdict
from typing import List, Dict, Any, Tuple

import csv
import xmltodict
import json
import xml.etree.ElementTree as ET


from fastapi import UploadFile

from configs.trace_config import TraceConfig
from repositories.trace_extractor_repository import TraceExtractorRepository


class DataExtractor:

    def __init__(self, trace_extractor_repository: TraceExtractorRepository, trace_config: TraceConfig):
        self.trace_extractor_repository = trace_extractor_repository

    async def get_block_coverage(self, files: List[UploadFile]):
        line_coverage_file = list(filter(lambda file: file.filename.endswith("linecoverage.xml"), files))
        if not line_coverage_file:
            return {}

        coverage_result = {}
        for file in line_coverage_file:
            content = await file.read()
            parsed_data = xmltodict.parse(content)
            if not parsed_data or not parsed_data["coverage"] or not parsed_data["coverage"]["block"]:
                return coverage_result

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
                if class_name not in coverage_result:
                    coverage_result[class_name] = [coverage_dict]
                else:
                    coverage_result[class_name].append(coverage_dict)
        return coverage_result

    # def _internal_to_qualified(self, internal: str) -> str:
    #     # com/example/Foo -> com.example.Foo
    #     return internal.replace('/', '.')
    #
    # def _top_level_only(self, internal: str) -> str:
    #     # com/example/Foo$Inner -> com/example/Foo ; com/example/Foo$1 -> com/example/Foo
    #     return internal.split('$', 1)[0]
    #
    # # ---------- main ----------
    # async def get_line_coverage(self, files: List[UploadFile]) -> Dict[str, Dict[str, Any]]:
    #     """
    #     Returns a dict keyed by top-level class name (fully qualified, dotted),
    #     with missing line numbers and their 0-based indices among executable lines.
    #
    #     {
    #       "com.example.Foo": {
    #         "total_executable_lines": 14,
    #         "total_missed_lines": 3,
    #         "missed_lines": [83, 97, 101],       # actual source line numbers
    #         "missed_indices": [0, 5, 7]          # 0-based positions in sorted executable-line list
    #       },
    #       ...
    #     }
    #     """
    #     jacoco_files = [f for f in files if f.filename.endswith("jacoco.xml")]
    #     if not jacoco_files:
    #         return {}
    #
    #     # Accumulators per class:
    #     #   - executable_lines: set of all executable line numbers seen (union across reports)
    #     #   - covered_lines   : set of line numbers seen as covered in any report
    #     class_exec_lines: Dict[str, set] = defaultdict(set)
    #     class_cov_lines: Dict[str, set] = defaultdict(set)
    #
    #     for up in jacoco_files:
    #         content = await up.read()
    #         try:
    #             root = ET.fromstring(content)
    #         except ET.ParseError:
    #             continue  # skip malformed XML
    #
    #         # 1) Build mapping (package, sourcefilename) -> top-level class (qualified)
    #         file_to_topclass: Dict[Tuple[str, str], str] = {}
    #         for pkg in root.findall("package"):
    #             pkg_name_internal = pkg.get("name", "")
    #             for cls in pkg.findall("class"):
    #                 internal_name = cls.get("name")
    #                 src_file = cls.get("sourcefilename")
    #                 if not internal_name or not src_file:
    #                     continue
    #                 top_level = self._top_level_only(internal_name)
    #                 key = (pkg_name_internal, src_file)
    #                 # first seen wins; normal Java has one public top-level per file
    #                 if key not in file_to_topclass:
    #                     file_to_topclass[key] = self._internal_to_qualified(top_level)
    #         # 2) Walk <sourcefile>/<line> and bucket into the owning top-level class
    #         for pkg in root.findall("package"):
    #             pkg_name_internal = pkg.get("name", "")
    #             for sf in pkg.findall("sourcefile"):
    #                 src_name = sf.get("name")
    #                 if not src_name:
    #                     continue
    #                 key = (pkg_name_internal, src_name)
    #                 if key not in file_to_topclass:
    #                     # No top-level class detected for this file (only inner/anonymous) — skip
    #                     continue
    #
    #                 class_name = file_to_topclass[key]
    #
    #                 # collect (nr, ci>0?) for this source file
    #                 lines: List[Tuple[int, bool]] = []
    #                 for ln in sf.findall("line"):
    #                     nr = ln.get("nr")
    #                     ci = ln.get("ci", "0")
    #                     if nr is None:
    #                         continue
    #                     try:
    #                         line_nr = int(nr)
    #                         is_cov = int(ci) > 0
    #                     except ValueError:
    #                         continue
    #                     lines.append((line_nr, is_cov))
    #
    #                 if not lines:
    #                     continue
    #
    #                 # Merge into class accumulators
    #                 for line_nr, is_cov in lines:
    #                     class_exec_lines[class_name].add(line_nr)
    #                     if is_cov:
    #                         class_cov_lines[class_name].add(line_nr)
    #
    #     # 3) Build final report with indices
    #     report: Dict[str, Dict[str, Any]] = {}
    #     for class_name, exec_set in class_exec_lines.items():
    #         # ordered list of executable lines for this class
    #         exec_lines_sorted = sorted(exec_set)
    #         covered = class_cov_lines.get(class_name, set())
    #         missed_lines = [ln for ln in exec_lines_sorted if ln not in covered]
    #
    #         # indices are positions in exec_lines_sorted
    #         idx_map = {ln: i for i, ln in enumerate(exec_lines_sorted)}
    #         missed_indices = [idx_map[ln] for ln in missed_lines]
    #
    #         report[class_name] = {
    #             "total_executable_lines": len(exec_lines_sorted),
    #             "total_missed_lines": len(missed_lines),
    #             "missed_lines": missed_lines,
    #             "missed_indices": missed_indices,
    #         }
    #
    #     return report

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
                class_name = row["mutatedClass"]
                mutation_dict = {
                    "status": row["@status"],
                    "number_of_tests": row["@numberOfTestsRun"],
                    "method_name": row["mutatedMethod"],
                    "method_desc": row["methodDescription"],
                    "line_number": row["lineNumber"],
                    "mutator": row["mutator"],
                    "blocks": row["blocks"],
                    "description": row["description"],
                    "killingTest": row["killingTest"],
                }
                if class_name not in mutations_result:
                    mutations_result[class_name] = [mutation_dict]
                else:
                    mutations_result[class_name].append(mutation_dict)
        return mutations_result


    def get_project_block_data(self, project_name: str, module: str, files: List[UploadFile], project_type: str = "maven"):
        logging.info("Total java .class file:" + str(len(files)))
        block_data = self.trace_extractor_repository.extract_block_data(project_name, files)
        result = {}
        if "data" not in block_data:
            print(module, len(files), len(files))
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


if "__main__" == __name__:
    with open("/Users/nabhansuwanachote/Desktop/pit-reports/linecoverage.xml", "r", encoding="utf-8") as file:
        xml_string = file.read()

    # Convert XML to Python dictionary
    data_dict = xmltodict.parse(xml_string)

    trace = DataExtractor(data_dict)
