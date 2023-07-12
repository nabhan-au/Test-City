import json
from services.file_manager.file_manager_service_abstract import FileManagerServiceAbstract
from repositories.file_manager_s3_repository import FileManagerS3Repository
from services.file_manager.file_manager_local_service import FileManagerLocalService
from typing import Dict, List


class FileManagerS3Service(FileManagerServiceAbstract):

    def __init__(self, s3_file_manager_repository: FileManagerS3Repository) -> None:
        self.__s3_file_manager_repository = s3_file_manager_repository

    def save_complexity(self, repository_name, metrics_manager_dict) -> None:
        tree_json = FileManagerLocalService.get_tree_json(metrics_manager_dict)
        tree_json = json.dumps(tree_json).encode('utf-8')
        self.__s3_file_manager_repository.upload_file(repository_name, tree_json)

    def get_complexity(self, repository_name) -> Dict:
        data = self.__s3_file_manager_repository.get_object(repository_name)
        if data is None:
            return None
        json_data = json.loads(data.decode('utf-8'))
        return json_data

    def get_project_list(self) -> List[str]:
        object_list = self.__s3_file_manager_repository.list_object()
        project_list = []
        for s3_object in object_list:
            project_list.append(s3_object.object_name.replace('_complexity.json', ''))
        return project_list
