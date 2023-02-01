import lizard
import os
from dictknife import deepmerge
import json
import requests
import copy
import numpy as np

from data_collector.coverall.downloads import CoverallDownloader
from data_collector.coverall.metrics import MetricsManager
from data_collector.util.path import PathBuilder
from data_collector.util.repo import RepositoryAnalyzer

num_line = {}
file_coverage = {}
ave_trace = {}
add_count = {}
filenames = []


def create_tree(metrics_manager_dict):
    tree = {}
    for filename in metrics_manager_dict.keys():
        path_list = filename.split('/')
        tree = deepmerge(tree, make_tree(path_list, metrics_manager_dict))
    return tree


def main(repositoryname):
    pb = PathBuilder(repositoryname)

    # プロジェクトの最新コミットを取得
    downloader = CoverallDownloader(pb)
    print(downloader.url)
    print(downloader.commit_sha)

    analyzer = RepositoryAnalyzer(pb)
    analyzer.clone_repo()# TODO: clone
    metrics_manager_dict = {}
    for file in analyzer.get_all_filenames():
        relative_filename = pb.get_relative_filepath_from_repo(file.filename)
        trace_list = downloader.get_trace(relative_filename)
        metrics_manager = MetricsManager(relative_filename)
        metrics_manager.extract_trace_metrics(trace_list)
        metrics_manager.add_loc_data(file)
        metrics_manager_dict[relative_filename] = metrics_manager
        print('SUCESS')
        break #This is for debug

    # TODO: ここからミステリーが始まる
    # 木作成
    # tree = create_tree(metrics_manager_dict)
    # print(tree)



    # jsonファイルに変換
    code_patterns = {}
    metrics_dict = {}

    for filename in metrics_manager_dict.keys():
        metrics = metrics_manager_dict[filename]
        # ファイルカバレッジを算出
        # file_coverage = metrics.file_coverage / metrics.add_count

        code_patterns.update({filename: {"classes": {"coverage": format(metrics.file_coverage, '.2f'),
                                                 "total_number_of_lines": str(metrics.num_line)},
                                     "functions": {"average_of_trace": format(metrics.avg_trace, '.2f'),
                                                   "total_number_of_lines": str(metrics.num_line)}}})
        metrics_dict.update({filename: {"total_number_of_characters": 0, "total_number_of_lines": str(metrics.num_line)}})

    tree_json = {"summary": {"python": {"code_patterns": code_patterns, "metrics": metrics_dict}}}

    print(tree_json)
    output_file = pb.visualizer_module + '/data/' + pb.project_name + '_complexity.json'
    with open(output_file, 'w') as f:
        json.dump(tree_json, f, indent=4)
        print("A file is made in " + output_file)


# 全ての親ノードにメトリクスを足す関数
def add_all_parents(path, metrics, current):
    if path not in metrics.keys():
        metrics[path] = 0
    metrics[path] += metrics[current]
    # ファイルカバレッジの場合，親ノードが末端ノード（ファイル）の平均を算出するための変数を準備
    if metrics == file_coverage:
        if path not in add_count.keys():
            add_count[path] = 0
        add_count[path] += 1
    # 親ノードが更に親ノードを持っていたらそのノードで再帰関数
    if '/' in path:
        path = path.split('/')[:-1]
        path = '/'.join(path)
        add_all_parents(path, metrics, current)

#TODO: ここから謎すぎる
def make_tree(path_list, metrics_manager_dict, parents=''):
    # 枝の末尾までいったら
    if (len(path_list) == 0): #FIXME: これがバグの原因じゃない？
        return {}
    # ルートだったら現在のノードをプロジェクト名に
    if parents == '':
        current = path_list[0]
    else:
        current = parents + '/' + path_list[0]
    # 再帰関数で子ノードを作成
    children = make_tree(path_list[1:], metrics_manager_dict, current)
    all_metrics = [num_line, file_coverage, ave_trace]

    # 全種類のメトリクスで全ての親ノードにメトリクスを足す
    for metrics in all_metrics:
        # 現在のノードがエッジノードなら全ての親ノードにメトリクスを足す
        if current in filenames:
            add_all_parents(parents, metrics, current)

    return {current: {"children": children, "total_number_of_lines": num_line[current],
                      "file_coverage": file_coverage[current], "average_of_trace": ave_trace[current]}}


if __name__ == "__main__":
    repository_name = 'google/apitools'
    main(repository_name)
