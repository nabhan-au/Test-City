import pprint
from collections import Counter
from io import StringIO
from typing import List, Dict, Any, Set

import xmltodict
import os
import re
import pandas as pd
from fastapi import UploadFile
import logging
import pprint

from services.file_manager.file_manager_service_abstract import FileManagerServiceAbstract
from services.data_extractor import DataExtractor
from util.datastructure import flat_map
from util.path import path_to_class


class CoverageProcessor:
    logger = logging.getLogger(__name__)

    INDEX_FILE_NAME = "index.html"

    def __init__(self, file_manager_service: FileManagerServiceAbstract, data_extractor: DataExtractor):
        self.file_manager_service = file_manager_service
        self.data_extractor_service = data_extractor

    def split_file_by_module(self, files, project_type):
        if project_type == "maven":
            identifier = "/target/"
        elif project_type == "gradle":
            identifier = "/build/"
        else:
            raise Exception(f"Unknown project type: {project_type}")

        result = {}
        for file in files:
            file_path = file.filename
            if identifier not in file_path:
                continue
            module = file_path.split(identifier)[0].split("/")[-1]
            if module in result:
                result[module].append(file)
            else:
                result[module] = [file]
        return result

    def filter_production_class_file(self, file, project_type):
        filename = file.filename
        if not filename.endswith(".class"):
            return False
        if project_type == "maven" and "/target/classes/" in filename:
            return True
        return False

    def summarize_mutations(self, mutations):
        if len(mutations) == 0:
            return {
                "total_mutations": 0,
                "killed": 0,
                "survived": 0,
                "no_coverage": 0,
                "executed_mutations": 0,
                "effective_killed": 0,
                "mutation_score_overall": 0,
                "mutation_score_executed": 0,
            }
        status_counts = Counter(m.get("status", "").upper() for m in mutations)
        total = len(mutations)

        killed = status_counts.get("KILLED", 0)
        survived = status_counts.get("SURVIVED", 0)
        timed_out = status_counts.get("TIMED_OUT", 0)
        memory_error = status_counts.get("MEMORY_ERROR", 0)
        no_cov = status_counts.get("NO_COVERAGE", 0)

        # 👉 treat TIMEOUT as killed if requested
        effective_killed = killed + timed_out + memory_error

        executed = total - no_cov
        mutation_score_overall = effective_killed / total if total else 0.0
        mutation_score_executed = effective_killed / executed if executed else 0.0

        return {
            "total_mutations": total,
            "killed": killed,
            "survived": survived,
            "no_coverage": no_cov,
            "executed_mutations": executed,
            "effective_killed": effective_killed,
            "mutation_score_overall": round(mutation_score_overall, 4),
            "mutation_score_executed": round(mutation_score_executed, 4),
        }

    async def integrate_mutation_tests(self, class_name, data, mutation_data):
        blocks = data.get("block", [])
        for mut in mutation_data:
            seen = set()
            mut["tests"] = []
            if mut["status"] != "SURVIVED":
                continue

            mutation_block = self._normalize_blocks(mut["blocks"])
            for b in blocks:
                if (
                        b["method_name"] == mut["method_name"]
                        and b["method_desc"] == mut["method_desc"]
                        and int(mut["line_number"]) in b["line"]
                        and str(b["block"]) in mutation_block
                ):
                    for test in b["tests"]:
                        key = test.get("@name") if isinstance(test, dict) else str(test)
                        if key not in seen:
                            seen.add(key)
                            mut["tests"].append(test)

    def integrate_mutation_location(self, mutation_block_dict, mutation_location_dict):
        current_line = mutation_block_dict["line_number"]
        mutation_block_dict["href"] = mutation_location_dict[int(current_line)]

    def merge_class(self, class1, class2):
        class1["mutation"]["details"].extend(class2["mutation"]["details"])
        new_tests = set(class1["tests"])
        new_tests.update(set(class2["tests"]))
        class1["tests"] = list(new_tests)
        class1["block"].extend(class2["block"])
        return class1

    async def extract_data(self, files, repo_name, report_path_map, mutation_html_link_map, project_type ="maven"):
        class_map = self.data_extractor_service.get_class_map(repo_name, files)

        class_to_file_map = {}
        for k, v in class_map.items():
            if k.split(".")[-1] != v.split("/")[-1].split(".java")[0]:
                split_class_name = k.split(".")
                split_class_name[-1] = v.split("/")[-1].split(".java")[0]
                class_to_file_map[k] = ".".join(split_class_name)


        files_by_modules = self.split_file_by_module(files, project_type)

        data = {}
        for module, files in files_by_modules.items():
            logging.info("Processing module %s", module)
            production_class_files = list(filter(lambda f: self.filter_production_class_file(f, project_type), files))
            if len(production_class_files) == 0:
                logging.info(f"{module} does not contain any .class files.")
                continue

            block_coverage, test_result = await self.data_extractor_service.get_block_coverage(files)
            block_data = self.data_extractor_service.get_project_block_data(repo_name, module, production_class_files)
            mutation_coverage_data = await self.data_extractor_service.get_mutation_block_data(files)

            for k, v in block_data.items():
                file_path = class_map.get(k, "")
                report_path = report_path_map.get(k, "")
                v["report_path"] = report_path

                # Code Coverage
                if k not in block_coverage:
                    logging.debug(f"Class {k} does not contain any line coverage data.")
                else:
                    await self.integrate_coverage_result(block_coverage[k], k, v)

                #Test cases
                if k not in test_result:
                    logging.debug(f"Class {k} does not contain any test result.")
                    v["tests"] = []
                else:
                    v["tests"] = list(test_result[k])

                #Mutation tests
                if k not in mutation_coverage_data:
                    mutation_data = []
                else:
                    mutation_data = mutation_coverage_data[k]
                    await self.integrate_mutation_tests(k, v, mutation_data)


                v["mutation"] =  {
                    "details": mutation_data
                }

            class_to_remove = []
            for k, v in block_data.items():
                if k not in class_to_file_map:
                    continue
                new_class = class_to_file_map[k]
                block_data[new_class] = self.merge_class(block_data[new_class], v)
                class_to_remove.append(k)

            logging.info(f"Converted class name: {', '.join(class_to_remove)}")
            for class_name in class_to_remove:
                del block_data[class_name]

            for k, v in block_data.items():
                mutation_data = v["mutation"]["details"]
                for mutation in mutation_data:
                    self.integrate_mutation_location(mutation, mutation_html_link_map[k])
                mutation_summary = self.summarize_mutations(mutation_data)
                v["mutation"] = {
                    **mutation_summary,
                    "details": mutation_data
                }

            summarized_result = self.summarize_block_style_coverage(block_data)
            data[module] = summarized_result

        return data

    async def integrate_coverage_result(self, coverage_result, class_name, data):
        for block in data["block"]:
            match_block = list(filter(
                lambda row:
                str(row["block"]) == str(block["block"]) and
                row["method_name_desc"] == f"{block['method_name']}{block['method_desc']}" and
                row["sub_class_name"] == block["sub_class_name"], coverage_result
            ))

            if len(match_block) > 1:
                logging.error(f"Multiple blocks found for class: {class_name} block: {block} with {match_block}")

            if len(match_block) == 0:
                logging.debug(f"{block} not covered")
                continue

            block["is_line_cover"] = True
            block["tests"] = match_block[0]["tests"]
            match_block[0]["found_match"] = True

    async def process_coverage(self, files: List[UploadFile], repo_name):
        report_path_map = await self.file_manager_service.upload_pitest_reports(files, repo_name)
        extracted_html_result = await self.data_extractor_service.extract_html_files(files)
        mutation_html_link_map = extracted_html_result["link_result"]
        logging.info(f"Processing {len(files)} files")
        coverage_result = await self.extract_data(files, repo_name, report_path_map, mutation_html_link_map)
        self.file_manager_service.save_complexity(repo_name, {"summary": coverage_result})
        return {
            "success": True,
        }

    from typing import Dict, Any, Iterable, List, Set

    def _normalize_line_range(self, line_range: Any) -> Iterable[int]:
        if line_range is None:
            return []
        if isinstance(line_range, int):
            return [line_range]
        if isinstance(line_range, (list, tuple)):
            # special case: exactly 2 ints -> treat as [start, end] inclusive range
            if len(line_range) == 2 and all(isinstance(x, int) for x in line_range):
                a, b = line_range
                lo, hi = (a, b) if a <= b else (b, a)
                return range(lo, hi + 1)
            # otherwise flatten any nested items
            out: List[int] = []
            for item in line_range:
                out.extend(list(self._normalize_line_range(item)))
            return out
        # Unknown type -> ignore
        return []

    def _normalize_blocks(self, field):
        if not field:
            return []
        if isinstance(field, dict) and "block" in field:
            val = field["block"]
            return val if isinstance(val, list) else [val]
        if isinstance(field, list):
            return field
        return [field]

    def summarize_block_style_coverage(self, data: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        report: Dict[str, Dict[str, Any]] = {}

        for class_name, payload in data.items():
            blocks = payload.get("block", [])
            converted_class_name = "/".join(class_name.split(".")) + ".java"

            # Gather all executable lines and lines marked covered
            exec_lines_set: Set[int] = set()
            covered_set: Set[int] = set()

            for b in blocks:
                lines_field = b.get("line", [])
                if not lines_field:
                    continue

                lines = {int(x) for x in lines_field}
                exec_lines_set |= lines
                if b.get("is_line_cover") is True:
                    covered_set |= lines

            if not exec_lines_set:
                del payload["block"]
                summary = {
                    "total_executable_lines": 0,
                    "total_covered_lines": 0,
                    "covered_indices": [],
                }
                report[converted_class_name] = {**payload, "line_coverage": summary}
                continue

            exec_sorted: List[int] = sorted(exec_lines_set)
            index_of = {ln: i for i, ln in enumerate(exec_sorted)}

            covered_indices = [index_of[ln] for ln in exec_sorted if ln in covered_set]

            total_exec = len(exec_sorted)
            total_covered = len(covered_set)

            summary = {
                "total_executable_lines": total_exec,
                "total_covered_lines": total_covered,
                "covered_indices": covered_indices,
            }
            del payload["block"]
            report[converted_class_name] = {**payload, "line_coverage": summary}

        return report