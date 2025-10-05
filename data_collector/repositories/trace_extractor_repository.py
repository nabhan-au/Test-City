import logging
import uuid
from typing import List

import requests
from fastapi import UploadFile

from configs.trace_config import TraceConfig


class TraceExtractorRepository:

    def __init__(self, trace_config: TraceConfig):
        self.url = trace_config.get_url

    def extract_block_data(
        self,
        project_name: str,
        files: List[UploadFile],
        chunk_size: int = 200,   # adjustable — how many files per request
    ):
        """
        Upload files in chunks to the block extractor server using the new API.
        """
        upload_id = str(uuid.uuid4())  # unique per upload session
        total_files = len(files)

        logging.info(f"Uploading {total_files} files for {project_name} (uploadId={upload_id})")

        for i in range(0, total_files, chunk_size):
            chunk = files[i:i + chunk_size]
            is_first = (i == 0)
            is_last = (i + chunk_size >= total_files)

            files_payload = [
                ("files", (file.filename.split("/target/classes/")[-1], file.file, file.content_type))
                for file in chunk
            ]

            params = {
                "uploadId": upload_id,
                "isFirst": str(is_first).lower(),
                "isLast": str(is_last).lower(),
            }

            logging.info(f"Uploading chunk {i//chunk_size + 1} "
                         f"({'first' if is_first else 'last' if is_last else 'middle'}) "
                         f"with {len(chunk)} files")

            response = requests.post(
                f"http://{self.url}/api/block/upload/{project_name}",
                files=files_payload,
                params=params,
            )

            if not response.ok:
                logging.error(f"Chunk upload failed: {response.status_code}, {response.text}")
                raise RuntimeError(f"Chunk upload failed: {response.text}")

            if is_last:
                result = response.json()
                logging.info(f"Upload complete: {result.get('message')}")
                return result

        logging.warning("No files uploaded.")
        return {"success": False, "message": "No files uploaded"}
