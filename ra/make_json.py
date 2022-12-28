import lizard
import os
from dictknife import deepmerge
import json

current_path = os.getcwd()
dataset_path = current_path + '/dataset/'
prjectname = 'jedis'
all_files = lizard.analyze([dataset_path + prjectname])
all_files = list(all_files)
num_line = {}
num_func = {}
num_comp = {}
filenames = []


def main():
    global filenames
    for file in all_files:
        filename = file.filename.replace(dataset_path, '')
        filenames += [filename]
        # 行数
        num_line[filename] = file.nloc # コメント，空白なし
        # 関数の数
        num_func[filename] = len(file.function_list)
        # 複雑度
        file_complexity = 0
        for function in file.function_list:
            file_complexity += function.cyclomatic_complexity
        num_comp[filename] = file_complexity

    # 木作成
    tree = {}
    for filename in filenames:
        path_list = filename.split('/')
        tree = deepmerge(tree,make_tree(path_list, num_line, num_func, num_comp))

    # jsonファイルに変換
    code_patterns = {}
    metrics = {}

    for filename in filenames:
        if filename == prjectname:
            name = ''
        name = filename
        code_patterns.update({name:{"classes":{"total_number_of_functions":str(num_func[filename]),"total_number_of_lines":str(num_line[filename])},"functions":{"total_cyclomatic_complexity":str(num_comp[filename]),"total_number_of_lines":str(num_line[filename])}}})
        metrics.update({name:{"total_number_of_characters":0,"total_number_of_lines":str(num_line[filename])}})

    tree_json = {"summary":{"python":{"code_patterns":code_patterns,"metrics":metrics}}}

    print(tree_json)

    with open(current_path + '/../src/data/' + prjectname + '_complexity.json', 'w') as f:
        json.dump(tree_json, f, indent=4)


def make_tree(path_list, num_line, num_func, num_comp, parents = ''):
    # 枝の末尾までいったら
    if(len(path_list)==0):
        return {}
    # ルートだったら
    if parents == '':
        current = path_list[0]
    else:
        current = parents + '/' + path_list[0]
    # 再帰関数で子ノードを作成
    children = make_tree(path_list[1:], num_line, num_func, num_comp, current)
    all_metrics = [num_line, num_func, num_comp]
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
    
    return {current:{"children": children, "total_number_of_lines": num_line[current], "total_number_of_functions": num_func[current], "total_cyclomatic_complexity": num_comp[current]}}


if __name__ == "__main__":
    main()
    