import json
from json import JSONDecodeError
from models.coverall_download_error import CoverallDownloadError
from models.coverall_download_not_found import CoverallDownloadNotFound
from models.coverall_download import CoverallDownloadModel
from util.request import Request
from util.path import PathBuilder
from typing import List
import requests


class CoverallDownloader:
    coverall_url = 'https://coveralls.io/github/'
    
    def __init__(self, request: Request) -> None:
        self.__request = request
        
    async def get_coverall_download_model(self, pb: PathBuilder) -> CoverallDownloadModel:
        url = self.coverall_url + pb.repository_name + '.json?branch=master'
        response = await self.__request.get(url)
        try:
            new_url = json.loads(response)
            return CoverallDownloadModel(new_url)
        except JSONDecodeError as e:
            raise CoverallDownloadNotFound("fail to request coverall data with message: ", e)
        except Exception as e: 
            raise CoverallDownloadError("fail to request coverall data with message: ", e)
        
    async def get_trace(self, coverall_download_model: CoverallDownloadModel, relative_filename: str) -> List:
        encoded_filename = relative_filename.replace('/', '%2F')
        url = 'https://coveralls.io/builds/' + coverall_download_model.commit_sha + '/source.json?filename=' + encoded_filename
        response = await self.__request.get(url)
        try:
            trace_list = json.loads(response)
            return trace_list
        except JSONDecodeError:
            print("Does not found")
            return None
