import argparse
import json
import copy

from services.coverall.downloads import CoverallDownloader
from services.coverall.metrics import MetricsManager
from services.ast_analyzer import AstAnalyzer
from services.file_manager.file_manager_service_abstract import FileManagerServiceAbstract
from models.coverall_download_error import CoverallDownloadError
from models.github_clone_repo_error import GithubCloneRepoError

from util.path import PathBuilder
from util.repo import RepositoryAnalyzer

class CoverallGenerator:

    def __init__(self, file_manager_service: FileManagerServiceAbstract, coverall_downloader: CoverallDownloader) -> None:
        self.__file_manager_service = file_manager_service
        self.__coverall_downloader = coverall_downloader

    def __add_metrics_into_tree(self, tree, merged_path, metrics):
        tree[merged_path]["file_coverage"] += metrics.file_coverage
        tree[merged_path]["add_count"] += metrics.add_count
        tree[merged_path]["num_line"] += metrics.num_line
        tree[merged_path]["avg_trace"] += metrics.avg_trace
        pass


    def __aggregate_directory_metrics(self, metrics_manager_dict):
        tree = {"": {"file_coverage": 0.0, "add_count": 0, "num_line": 0, "avg_trace": 0.0}}
        for filename in metrics_manager_dict.keys():
            path_list = filename.split('/')
            merged_path = ""
            metrics = metrics_manager_dict[filename]
            for i in range(0, len(path_list) - 1):
                if merged_path == "":
                    merged_path += path_list[i]
                else:
                    merged_path += "/" + path_list[i]

                if merged_path not in tree:
                    tree[merged_path] = {"file_coverage": 0.0, "add_count": 0, "num_line": 0, "avg_trace": 0.0}
                else:
                    pass  # already exists

                self.__add_metrics_into_tree(tree, merged_path, metrics)
            self.__add_metrics_into_tree(tree, "", metrics)

        for filename in tree:
            print(filename, tree[filename]["add_count"])
            tree[filename]["file_coverage"] = tree[filename]["file_coverage"] / tree[filename]["add_count"]

        return tree


    def __classify_trace_list(self, metrics_manager_dict):
        filenames = list(metrics_manager_dict.keys()).copy()
        for filename in filenames:
            metrics = metrics_manager_dict[filename]
            for trace in metrics.trace_list:
                path = filename + "/" + str(trace)
                if path in metrics_manager_dict.keys():
                    continue
                metrics_manager_dict[path] = copy.deepcopy(metrics)
                metrics_manager_dict[path].avg_trace = trace
                metrics_manager_dict[path].is_trace = True


    def __classify_trace_list_by_branch_line(self, metrics_manager_dict, repository_name, extension):
        filenames = list(metrics_manager_dict.keys()).copy()
        ast_analyzer = AstAnalyzer(repository_name)
        filename_and_line_list = ast_analyzer.analyze(extension)
        for filename in filenames:
            if filename not in filename_and_line_list.keys():
                continue
            metrics = metrics_manager_dict[filename]
            for count, line in enumerate(filename_and_line_list[filename]):
                trace = metrics_manager_dict[filename].trace_list[line - 1]
                if trace is not None:
                    path = filename + "/" + str(line)
                    metrics_manager_dict[path] = copy.deepcopy(metrics)
                    metrics_manager_dict[path].avg_trace = trace
                    metrics_manager_dict[path].is_trace = True
                    if count != len(filename_and_line_list[filename])-1:
                        metrics_manager_dict[path].num_line = filename_and_line_list[filename][count+1] - filename_and_line_list[filename][count]
                    else:
                        metrics_manager_dict[path].num_line = metrics.num_line - filename_and_line_list[filename][count] + 1


    async def generate_repository_data(self, repository_name):
        pb = PathBuilder(repository_name)

        # プロジェクトの最新コミットを取得
        downloader_model = await self.__coverall_downloader.get_coverall_download_model(pb)
        print(downloader_model.url)
        print(downloader_model.commit_sha)

        analyzer = RepositoryAnalyzer(pb)
        try:
            analyzer.clone_repo(downloader_model.commit_sha)
        except Exception as e:
            raise GithubCloneRepoError("fail to clone repo with repo name: ", repository_name, " with message: ", e)
        metrics_manager_dict = {}
        extension_list = ['.py', '.go', '.java']
        extension_count_dict = {}
        for extension in extension_list:
            extension_count_dict[extension] = 0
        for file in analyzer.get_all_filenames():
            for extension in extension_list:
                if file.filename.endswith(extension):
                    extension_count_dict[extension] += 1
            relative_filename = pb.get_relative_filepath_from_repo(file.filename)
            trace_list = await self.__coverall_downloader.get_trace(downloader_model, relative_filename)
            if trace_list is None:
                continue
            if trace_list.count(None) == len(trace_list):
                print('All trace is None')
                continue
            metrics_manager = MetricsManager(relative_filename)
            metrics_manager.extract_trace_metrics(trace_list)
            metrics_manager.add_loc_data(file)
            metrics_manager_dict[relative_filename] = metrics_manager
            print('SUCCESS')

        extension = max(extension_count_dict, key=extension_count_dict.get)
        # 木作成
        tree = self.__aggregate_directory_metrics(metrics_manager_dict)
        self.__classify_trace_list_by_branch_line(metrics_manager_dict, repository_name, extension)
        for filename in tree:
            metrics_manager_dict[filename] = MetricsManager.create_instance(filename, tree[filename])

        self.__file_manager_service.save_complexity(f"{pb.organization_name}_{pb.project_name}", metrics_manager_dict)

        # Remove cloned repository after finish generate json
        analyzer.remove_repo()
