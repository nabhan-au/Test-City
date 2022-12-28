from dictknife import deepmerge

def add(path_list, metrics, parents = ''):
    if(len(path_list)==0):
        return {}
    if parents == '':
        current = path_list[0]
    else:
        current = parents + '/' + path_list[0]
    children = add(path_list[1:], metrics, current)

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

    # 現在のノードがエッジノードなら
    if current in filenames:
        add_all_parents(parents)
    print(current, metrics[current])
    return {path_list[0]:{"children":children, "path":current, "metric":metrics[current]}}


trees = {}
filenames = ['aaa/ddd/bbb.txt', 'aaa/ccc.txt', 'aaa/ddd/eee.txt']
metrics = {}
metrics[filenames[0]] = 3
metrics[filenames[1]] = 5
metrics[filenames[2]] = 4
# metrics['aaa'] = 8
for filename in filenames:
    path_list = filename.split('/')
    trees = deepmerge(trees,add(path_list, metrics))
print(trees)