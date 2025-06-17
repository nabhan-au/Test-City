from collections import defaultdict

import xmltodict
import subprocess
import re
import ast

from configs.trace_config import TraceConfig


class TraceExtractor:

    def __init__(self, trace_config: TraceConfig):
        self.jar_path = trace_config.get_jar_file_path
        self.jar_path = "/Users/nabhansuwanachote/Desktop/code/code-is-beautiful/block-extractor/out/artifacts/block_extractor_jar/block-extractor.jar"

    def run_block_count(self, target_dir):
        target_dir = "/Users/nabhansuwanachote/Desktop/code/commons-codec/target"
        result = subprocess.run(
            ["java", "-jar", self.jar_path, target_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True  # Return output as string (not bytes)
        )
        return self.parse_java_output(result.stdout)

    def parse_java_output(self, java_output):
        # Pattern to match each BlockLocation entry
        pattern = re.compile(
            r"BlockLocation\s+\[location=Location\s+\[clazz=(?P<class>[^,]+),\s+method=(?P<method>[^,]+),\s+methodDesc=(?P<desc>[^\]]+)\],\s+block=(?P<block>\d+)\]=(?P<lines>\[[^\]]*\])"
        )

        results = []
        for match in pattern.finditer(java_output):
            clazz = match.group("class")
            method = match.group("method")
            desc = match.group("desc")
            block = int(match.group("block"))
            lines = ast.literal_eval(match.group("lines"))  # safely parse list

            results.append({
                "class": clazz,
                "method": method,
                "desc": desc,
                "block": block,
                "lines": lines
            })

        return results

    def count_blocks_by_class(self, parsed_entries):
        block_counts = defaultdict(list)

        for entry in parsed_entries:
            block_counts[entry["class"]].append(entry["block"])  # avoid duplicate blocks

        # Convert sets to counts
        return {cls: len(blocks) for cls, blocks in block_counts.items()}





if "__main__" == __name__:
    with open("/Users/nabhansuwanachote/Desktop/pit-reports/linecoverage.xml", "r", encoding="utf-8") as file:
        xml_string = file.read()

    # Convert XML to Python dictionary
    data_dict = xmltodict.parse(xml_string)

    trace = TraceExtractor(data_dict)
