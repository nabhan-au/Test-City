from repositories.file_manager_local_repository import FileManagerLocalRepository
from util.path import PathBuilder
from services.file_manager.file_manager_service_abstract import FileManagerServiceAbstract
from typing import Dict, List

class FileManagerLocalService(FileManagerServiceAbstract):
        
    def __init__(self, file_manager: FileManagerLocalRepository) -> None:
        self.__file_manager = file_manager
        
    def save_complexity(self, repository_name, metrics_manager_dict) -> None:
        self.__file_manager.save_to_json(repository_name, metrics_manager_dict)
        
    def get_complexity(self, repository_name) -> Dict:
        pb = PathBuilder(repository_name)
        output_file = pb.top_dir + '/data/' + pb.project_name + '_complexity.json'
        return self.__file_manager.get_json_file(output_file)
        
    
    def get_project_list(self) -> List[str]:
        repo_name_list = []
        file_list = self.__file_manager.get_file_list()
        for file_name in file_list:
            repo_name = file_name.replace('_complexity.json', '')
            repo_name_list.append(repo_name)
        return repo_name_list