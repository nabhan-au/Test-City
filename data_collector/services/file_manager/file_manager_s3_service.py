import json
import logging

from fastapi import UploadFile

from models.common_response import CommonResponse
from services.file_manager.file_manager_service_abstract import FileManagerServiceAbstract
from repositories.file_manager_s3_repository import FileManagerS3Repository
from services.file_manager.file_manager_local_service import FileManagerLocalService
from typing import Dict, List, Any

from util.path import is_path_valid


class FileManagerS3Service(FileManagerServiceAbstract):

    def __init__(self, s3_file_manager_repository: FileManagerS3Repository, s3_bucket_name) -> None:
        self.__s3_file_manager_repository = s3_file_manager_repository
        self.__s3_bucket_name = s3_bucket_name
        self.__s3_pit_reports_bucket = "pit-reports"

    def save_complexity(self, repository_name, tree_json) -> None:
        tree_json = json.dumps(tree_json).encode('utf-8')
        self.__s3_file_manager_repository.upload_file(repository_name, tree_json, self.__s3_bucket_name)

    def get_complexity(self, repository_name) -> Any:
        data = self.__s3_file_manager_repository.get_object(repository_name, self.__s3_bucket_name)
        if data is None:
            return None
        json_data = json.loads(data.decode('utf-8'))
        return json_data

    def get_project_list(self) -> List[str]:
        object_list = self.__s3_file_manager_repository.list_object(self.__s3_bucket_name)
        project_list = []
        for s3_object in object_list:
            project_list.append(s3_object.object_name.replace('_complexity.json', ''))
        return project_list

    async def upload_project_target(self, files: List[UploadFile], project_name: str) -> CommonResponse:
        for file in files:
            relative_path = file.filename
            if not is_path_valid(relative_path, ['/classes/']):
                continue
            relative_path = relative_path.split('/classes/')[-1]
            s3_key = f"{project_name}/{relative_path}"
            await self.__s3_file_manager_repository.upload_raw_file(file, s3_key, "temp")
        return CommonResponse(True, "Uploaded successfully")


    async def upload_pitest_reports(self, files: List[UploadFile], project_name: str) -> dict[str, str]:
        """
        Upload PIT mutation reports to a public S3 bucket.
        Files are uploaded to the pit-reports bucket under {project_name}/pit-reports/.
        """
        path_map = {}
        for file in files:
            if ".html" not in file.filename and ".css" not in file.filename and ".js" not in file.filename:
                continue
            relative_path = file.filename

            # Preserve folder structure for clarity in S3
            s3_key = f"{project_name}/{relative_path.split('pit-reports/')[-1]}"
            class_path = ".".join(relative_path.split('pit-reports/')[-1].split("/"))
            class_path = class_path.split('.java.html')[0].split(".html")[0]
            path_map[class_path] = s3_key

            # Upload file to public bucket
            await self.__s3_file_manager_repository.upload_raw_file(
                file,
                s3_key,
                self.__s3_pit_reports_bucket
            )
        for f in files:
            f.file.seek(0)
        logging.info(f"🎯 All PIT reports uploaded successfully for project '{project_name}'.")
        return path_map
