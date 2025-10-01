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

    def compute_average_block_trace(self, block_data: dict) -> dict:
        """
        For each class in block_data, compute the average number of tests per block
        and add it into the dict as `average_block_trace`.

        Example output for each class:
          {
            ...,
            "average_block_trace": 3.75
          }
        """
        for class_name, payload in block_data.items():
            blocks = payload.get("block", [])
            if not blocks:
                payload["average_block_trace"] = 0.0
                continue

            total_tests = 0
            total_blocks = 0
            for b in blocks:
                tests = b.get("tests", [])
                total_tests += len(tests)
                total_blocks += 1

            avg_trace = round(total_tests / total_blocks, 2) if total_blocks else 0.0
            payload["average_block_trace"] = avg_trace
            payload["total_blocks"] = total_blocks
            payload["total_tests"] = total_tests

        return block_data

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
        no_cov = status_counts.get("NO_COVERAGE", 0)

        # 👉 treat TIMEOUT as killed if requested
        effective_killed = killed + timed_out

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

    async def extract_data(self, coverage_result, files, repo_name, project_type ="maven"):
        files_by_modules = self.split_file_by_module(files, project_type)

        data = {}
        for module, files in files_by_modules.items():
            production_class_files = list(filter(lambda f: self.filter_production_class_file(f, project_type), files))
            if len(production_class_files) == 0:
                logging.info(f"{module} does not contain any .class files.")
                continue

            block_data = self.data_extractor_service.get_project_block_data(repo_name, module, production_class_files)
            block_coverage = await self.data_extractor_service.get_block_coverage(files)
            mutation_coverage_data = await self.data_extractor_service.get_mutation_block_data(files)


            for k, v in block_data.items():
                if k not in block_coverage:
                    logging.info(f"Class {k} does not contain any line coverage data.")
                else:
                    await self.integrate_coverage_result(block_coverage[k], k, v)
                if k not in mutation_coverage_data:
                    mutation_data = []
                else:
                    mutation_data = mutation_coverage_data[k]
                mutation_summary = self.summarize_mutations(mutation_data)
                v["mutation"] =  {
                     **mutation_summary,
                    "details": mutation_data
                }

            block_data = self.compute_average_block_trace(block_data)
            summarized_result = self.summarize_block_style_coverage(block_data)
            data[module] = summarized_result

        return data


        #
        # for k, v in block_data.items():
        #     print(k)
        #     pprint.pprint(v)
        #     break
        #
        # for k, v in block_coverage_data.items():
        #     print(k)
        #     pprint.pprint(v)
        #     break
        #
        #
        #
        # raise Exception("test")
        #
        # for row in coverage_result:
        #     path = row["path"]
        #     class_path = path_to_class(path)
        #     block_data[class_path] = {
        #         "lines": row["lines"],
        #         "mutations": row["mutations"]
        #
        #     }
        #
        #
        # # block_coverage_data = await self.trace_extractor_service.get_block_coverage(files)
        # for row in coverage_result:
        #     path = row["path"]
        #     class_path = path_to_class(path)
        #     total_block = block_data[class_path]
        #     # total_trace = block_coverage_data[class_path] if class_path in block_coverage_data else 0
        #     data = {
        #         path: {
        #             "lines": row["lines"],
        #             "mutations": row["mutations"],
        #             "traces": {
        #                 "total_trace": 0,
        #                 "total_block": total_block,
        #                 "average": 0 / total_block
        #             }
        #         },
        #     }
        #     coverage_trace_result.append(data)
        # return coverage_trace_result

    async def integrate_coverage_result(self, coverage_result, class_name, data):
        for block in data["block"]:
            match_block = list(filter(
                lambda row:
                str(row["block"]) == str(block["block"]) and
                row["method_name_desc"] == f"{block['method_name']}{block['method_desc']}" and
                row["sub_class_name"] == block["sub_class_name"], coverage_result
            ))

            if len(match_block) > 1:
                raise Exception(f"Multiple blocks found for class: {class_name} block: {block} with {match_block}")

            if len(match_block) == 0:
                logging.info(f"{block} not covered")
                continue

            block["is_line_cover"] = True
            block["tests"] = match_block[0]["tests"]
            match_block[0]["found_match"] = True

    async def process_coverage(self, files: List[UploadFile], repo_name):
        logging.info(f"Processing {len(files)} files")
        coverage_result = []
        # index_file_list = await self.list_index_file(files)
        # for index_file in index_file_list:
        #     process_data = await self.process_html_file(index_file)
        #     result = flat_map(lambda x: self.get_tree_from_table(process_data['file_path'], x), process_data['table'])
        #     coverage_result.extend(result)

        coverage_result = await self.extract_data(coverage_result, files, repo_name)
        self.file_manager_service.save_complexity(repo_name, {"summary": coverage_result})
        return {
            "success": True,
        }

    from typing import Dict, Any, Iterable, List, Set

    def _normalize_line_range(self, line_range: Any) -> Iterable[int]:
        """
        Accepts several shapes and yields concrete line numbers:
          - int                         -> [int]
          - [int, int] (start,end)      -> inclusive range [start..end]
          - [int, int, ...]             -> list of individual lines
          - list/tuple of such mixes    -> flatten recursively
        """
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

    def summarize_block_style_coverage(self, data: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        report: Dict[str, Dict[str, Any]] = {}

        for class_name, payload in data.items():
            blocks = payload.get("block", [])

            # Gather all executable lines and lines marked covered
            exec_lines_set: Set[int] = set()
            covered_set: Set[int] = set()

            for b in blocks:
                # "line" is always a list of ints per your schema
                lines_field = b.get("line", [])
                if not lines_field:
                    continue

                # Defensive cast to int in case upstream slipped strings
                lines = {int(x) for x in lines_field}
                exec_lines_set |= lines
                if b.get("is_line_cover") is True:
                    covered_set |= lines

            # If nothing executable, produce an empty summary and continue
            if not exec_lines_set:
                summary = {
                    "total_executable_lines": 0,
                    "total_missed_lines": 0,
                    "missed_lines": [],
                    "missed_indices": [],
                    "covered_indices": [],
                    "coverage_pct": 0.0,
                }
                report[class_name] = {**payload, "line_coverage": summary}
                continue

            # Create a stable ordering of executable lines and map to indices
            exec_sorted: List[int] = sorted(exec_lines_set)
            index_of = {ln: i for i, ln in enumerate(exec_sorted)}

            # Missed = executable - covered
            missed_lines = [ln for ln in exec_sorted if ln not in covered_set]
            missed_indices = [index_of[ln] for ln in missed_lines]
            covered_indices = [index_of[ln] for ln in exec_sorted if ln in covered_set]

            total_exec = len(exec_sorted)
            total_missed = len(missed_lines)
            coverage_pct = round(((total_exec - total_missed) / total_exec) * 100.0, 2)

            summary = {
                "total_executable_lines": total_exec,
                "total_missed_lines": total_missed,
                "missed_lines": missed_lines,
                "missed_indices": missed_indices,
                "covered_indices": covered_indices,
                "coverage_pct": coverage_pct,
            }
            report[class_name] = {**payload, "line_coverage": summary}

        return report