import lizard
import os
from dictknife import deepmerge
import json
import requests

current_path = os.path.dirname(os.path.abspath(__file__))
dataset_path = current_path + '/dataset/'
prjectname = 'jedis'
all_files = lizard.analyze([dataset_path + prjectname])
all_files = list(all_files)
num_line = {}
file_coverage = {}
ave_coverage = {}
filenames = []


def main():
    global filenames
    for file in all_files:
        filename = file.filename.replace(dataset_path, '')
        filenames += [filename]
        # 行数
        num_line[filename] = file.nloc # コメント，空白なし
        # ファイルのカバレッジと，テスト通った回数の平均
        file_url = filename.replace('/', '%2F')
        url = requests.get('https://coveralls.io/builds/2ea77ec5eeea2351de50b268994ba69f876b815c/source.json?filename=' + file_url)
        coverage_list = json.loads(url.text)
        sum = 0
        line = 0
        not_zero = 0
        for coverage in coverage_list:
            if coverage != None:
                sum += coverage
                line += 1
                if coverage != 0:
                    not_zero += 1
        file_coverage[filename] = format(100*float(not_zero)/line, '2f')
        ave_coverage[filename] = format(float(sum)/line, '.2f')

    # 木作成
    tree = {}
    for filename in filenames:
        path_list = filename.split('/')
        tree = deepmerge(tree,make_tree(path_list, num_line, file_coverage, ave_coverage))

    # jsonファイルに変換
    code_patterns = {}
    metrics = {}

    for filename in filenames:
        if filename == prjectname:
            name = ''
        name = filename
        code_patterns.update({name:{"classes":{"total_number_of_functions":str(file_coverage[filename]),"total_number_of_lines":str(num_line[filename])},"functions":{"total_cyclomatic_complexity":str(ave_coverage[filename]),"total_number_of_lines":str(num_line[filename])}}})
        metrics.update({name:{"total_number_of_characters":0,"total_number_of_lines":str(num_line[filename])}})

    tree_json = {"summary":{"python":{"code_patterns":code_patterns,"metrics":metrics}}}

    print(tree_json)

    with open(current_path + '/../src/data/' + prjectname + '_complexity.json', 'w') as f:
        json.dump(tree_json, f, indent=4)


def make_tree(path_list, num_line, file_coverage, ave_coverage, parents = ''):
    # 枝の末尾までいったら
    if(len(path_list)==0):
        return {}
    # ルートだったら
    if parents == '':
        current = path_list[0]
    else:
        current = parents + '/' + path_list[0]
    # 再帰関数で子ノードを作成
    children = make_tree(path_list[1:], num_line, file_coverage, ave_coverage, current)
    all_metrics = [num_line, file_coverage, ave_coverage]
    # 全ての親ノードにメトリクスを足す関数
    def add_all_parents(path):
        if path not in metrics.keys():
            metrics[path] = 0
        metrics[path] += metrics[current]
        # 親ノードが更に親ノードを持っていたらそのノードで再帰関数
        if '/' in path:
            path = path.split('/')[:-1]
            path = '/'.join(path)
            add_all_parents(path)
    # 全種類のメトリクスで全ての親ノードにメトリクスを足す
    for metrics in all_metrics:
        # 現在のノードがエッジノードなら全ての親ノードにメトリクスを足す
        if current in filenames:
            add_all_parents(parents)
    
    return {current:{"children": children, "total_number_of_lines": num_line[current], "total_number_of_functions": file_coverage[current], "total_cyclomatic_complexity": ave_coverage[current]}}


if __name__ == "__main__":
    main()
    