from typing import Dict, List
from util.path import PathBuilder
import json
import os

class FileManagerLocalRepository():
        
    def save_to_json(self, output_file, json_data) -> None:
        with open(output_file, 'w') as f:
            json.dump(json_data, f, indent=4)
            print("A file is made in " + output_file)
        
    def get_json_file(self, repository_path) -> Dict:
        try:
            with open(repository_path, 'r') as f:
                complexity_dict = json.load(f)
            return complexity_dict
        except Exception:
            return None
    
    def get_file_list(self) -> List[str]:
        top_dir = PathBuilder.get_top_dir()
        dir_list = os.listdir(os.path.join(top_dir, 'data'))
        return dir_list
            
            