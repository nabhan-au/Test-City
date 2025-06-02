from abc import ABC, abstractmethod
from typing import List, Dict

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