from abc import ABC, abstractmethod
from typing import List, Dict

class FileManagerServiceAbstract(ABC):
    
    @abstractmethod
    def save_complexity(pb, metrics_manager_dict) -> None:
        pass
    
    @abstractmethod
    def get_complexity(project_name) -> Dict:
        pass
    
    @abstractmethod
    def get_project_list() -> List[str]:
        pass