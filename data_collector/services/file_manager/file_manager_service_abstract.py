from abc import ABC, abstractmethod
from typing import List, Dict

from fastapi import UploadFile


class FileManagerServiceAbstract(ABC):
    
    @abstractmethod
    def save_complexity(self, pb, tree_json) -> None:
        raise NotImplementedError
    
    @abstractmethod
    def get_complexity(self, project_name) -> Dict:
        raise NotImplementedError
    
    @abstractmethod
    def get_project_list(self) -> List[str]:
        raise NotImplementedError

    @abstractmethod
    def upload_pitest_reports(self, files: List[UploadFile], project_name: str) -> Dict[str, str]:
        raise NotImplementedError