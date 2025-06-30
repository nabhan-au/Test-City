from collections import defaultdict
from typing import List

import xmltodict
import json


from fastapi import UploadFile

from configs.trace_config import TraceConfig
from repositories.trace_extractor_repository import TraceExtractorRepository


class TraceExtractor:

    def __init__(self, trace_extractor_repository: TraceExtractorRepository, trace_config: TraceConfig):
        self.trace_extractor_repository = trace_extractor_repository

    async def get_block_coverage(self, files: List[UploadFile]):
        line_coverage_file = list(filter(lambda file: file.filename.endswith("linecoverage.xml"), files))

        if not line_coverage_file:
            raise ValueError("linecoverage.xml not found among uploaded files.")
        if len(line_coverage_file) > 1:
            raise ValueError("multiple linecoverage.xml files found. Only one file may be uploaded.")

        # Read content as string
        content = await line_coverage_file[0].read()

        # Parse XML to dict
        coverage_data = xmltodict.parse(content)["coverage"]["block"]

        coverage_count = {}
        for row in coverage_data:
            classname = row["@classname"]
            tests = row["tests"]['test']
            if classname not in coverage_count:
                coverage_count[classname] = len(tests)
            else:
                coverage_count[classname] += len(tests)
        return coverage_count

    def get_project_block_data(self, project_name: str, files: List[UploadFile]):
        files = list(filter(lambda file: file.filename.endswith(".class"), files))
        response = self.trace_extractor_repository.extract_block_data(project_name, files)
        result = {}
        print("response:", response)
        for row in response["data"]:
            clazz = row["clazz"]
            if clazz not in result:
                result[clazz] = 0
            else:
                result[clazz] += 1
        return result


if "__main__" == __name__:
    with open("/Users/nabhansuwanachote/Desktop/pit-reports/linecoverage.xml", "r", encoding="utf-8") as file:
        xml_string = file.read()

    # Convert XML to Python dictionary
    data_dict = xmltodict.parse(xml_string)

    trace = TraceExtractor(data_dict)
