import json
from json import JSONDecodeError
from typing import Dict
import requests

class CoverallDownloadModel:
    
    def __init__(self, url: Dict) -> None:
        self.url = url
        self.commit_sha = self.url['commit_sha']