import json
import copy
from data_collector.coverall.downloads import CoverallDownloader
from data_collector.coverall.metrics import MetricsManager
from data_collector.util.path import PathBuilder
from data_collector.util.repo import RepositoryAnalyzer


def add_metrics_into_tree(tree, merged_path, metrics):
    tree[merged_path]["file_coverage"] += metrics.file_coverage
    tree[merged_path]["add_count"] += metrics.add_count
    tree[merged_path]["num_line"] += metrics.num_line
    tree[merged_path]["avg_trace"] += metrics.avg_trace
    pass


def aggregate_directory_metrics(metrics_manager_dict):
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

            add_metrics_into_tree(tree, merged_path, metrics)
        add_metrics_into_tree(tree, "", metrics)

    for filename in tree:
        print(filename, tree[filename]["add_count"])
        tree[filename]["file_coverage"] = tree[filename]["file_coverage"] / tree[filename]["add_count"]

    return tree


def classify_trace_list(metrics_manager_dict):
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


def classify_trace_list_by_line(metrics_manager_dict):
    filenames = list(metrics_manager_dict.keys()).copy()
    for filename in filenames:
        metrics = metrics_manager_dict[filename]
        for line, trace in enumerate(metrics.trace_list):
            path = filename + "/" + str(line+1)
            metrics_manager_dict[path] = copy.deepcopy(metrics)
            metrics_manager_dict[path].avg_trace = trace
            metrics_manager_dict[path].is_trace = True


def create_json(output_file, metrics_manager_dict):
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

    with open(output_file, 'w') as f:
        json.dump(tree_json, f, indent=4)
        print("A file is made in " + output_file)
    pass


def main(repositoryname):
    pb = PathBuilder(repositoryname)

    # プロジェクトの最新コミットを取得
    downloader = CoverallDownloader(pb)
    print(downloader.url)
    print(downloader.commit_sha)

    analyzer = RepositoryAnalyzer(pb)
    analyzer.clone_repo(downloader.commit_sha)
    metrics_manager_dict = {}
    i = 0
    for file in analyzer.get_all_filenames():
        relative_filename = pb.get_relative_filepath_from_repo(file.filename)
        trace_list = downloader.get_trace(relative_filename)
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

    # 木作成
    tree = aggregate_directory_metrics(metrics_manager_dict)
    classify_trace_list_by_line(metrics_manager_dict)
    for filename in tree:
        metrics_manager_dict[filename] = MetricsManager.create_instance(filename, tree[filename])

    output_file = pb.visualizer_module + '/data/' + pb.project_name + '_complexity.json'
    create_json(output_file, metrics_manager_dict)


if __name__ == "__main__":
    repository_name = 'google/go-jsonnet'
    main(repository_name)
