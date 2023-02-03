import json
from json import JSONDecodeError
import requests


class CoverallDownloader:
    coverall_url = 'https://coveralls.io/github/'

    def __init__(self, pb):
        self.path_builder = pb
        url = self.coverall_url + self.path_builder.repository_name + '.json?branch=master'
        print(url)
        r = requests.get(url)
        self.url = json.loads(r.text)
        self.commit_sha = self.url['commit_sha']

    def get_trace(self, relative_filename):
        # ファイルのカバレッジと，テスト通った回数の平均
        encoded_filename = relative_filename.replace('/', '%2F')
        url = 'https://coveralls.io/builds/' + self.commit_sha + '/source.json?filename=' + encoded_filename
        r = requests.get(url)
        try:
            trace_list = json.loads(r.text)
            return trace_list
        except JSONDecodeError:
            print("Does not found")
            return None
