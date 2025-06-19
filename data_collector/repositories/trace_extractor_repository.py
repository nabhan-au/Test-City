from typing import List

import requests
from fastapi import UploadFile

from configs.trace_config import TraceConfig


class TraceExtractorRepository:

    def __init__(self, trace_config: TraceConfig):
        self.url = trace_config.get_url

    def extract_block_data(self, project_name: str, files: List[UploadFile]):
        files_payload = [
            ("files", (file.filename.split("/target/classes/")[-1], file.file, file.content_type))
            for file in files
        ]
        response = requests.post(
            f"http://{self.url}/api/block/upload/{project_name}",
            files=files_payload
        )
        return response.json()
