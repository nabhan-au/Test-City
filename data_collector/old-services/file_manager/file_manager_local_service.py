from repositories.file_manager_local_repository import FileManagerLocalRepository
from util.path import PathBuilder
from services.file_manager.file_manager_service_abstract import FileManagerServiceAbstract
from typing import Dict, List


class FileManagerLocalService(FileManagerServiceAbstract):

    def __init__(self, file_manager: FileManagerLocalRepository) -> None:
        self.__file_manager = file_manager

    def save_complexity(self, repository_name, metrics_manager_dict) -> None:
        pb = PathBuilder(repository_name)
        output_file = pb.top_dir + '/data/' + pb.project_name + '_complexity.json'

        tree_json = self.get_tree_json(metrics_manager_dict)
        self.__file_manager.save_to_json(output_file, tree_json)

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

    @staticmethod
    def get_tree_json(metrics_manager_dict):
        # jsonファイルに変換
        code_patterns = {}
        metrics_dict = {}
        for filename in metrics_manager_dict.keys():
            metrics = metrics_manager_dict[filename]
            if not metrics.is_trace:
                trace_name = "average"
            else:
                trace_name = "number"
            code_patterns.update({filename: {"classes": {"coverage": format(metrics.file_coverage, '.2f'),
                                                         "total_number_of_lines": str(metrics.num_line)},
                                             "functions": {trace_name + "_of_trace": format(metrics.avg_trace, '.2f'),
                                                           "total_number_of_lines": str(metrics.num_line)}}})
            metrics_dict.update(
                {filename: {"total_number_of_characters": 0, "total_number_of_lines": str(metrics.num_line)}})
        tree_json = {"summary": {"python": {"code_patterns": code_patterns, "metrics": metrics_dict}}}
        return tree_json
