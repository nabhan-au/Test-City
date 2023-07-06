from typing import Dict, List
from util.path import PathBuilder
import json
import os

class FileManagerLocalRepository():
        
    def save_to_json(self, repository_name, metrics_manager_dict) -> None:
        pb = PathBuilder(repository_name)
        output_file = pb.top_dir + '/data/' + pb.project_name + '_complexity.json'
        
        # jsonファイルに変換
        code_patterns = {}
        metrics_dict = {}

        for filename in metrics_manager_dict.keys():
            metrics = metrics_manager_dict[filename]
            if not metrics.is_trace:
                trace_name = "average"
            else:
                trace_name = "number"
            code_patterns.update({filename: {"classes": {"coverage": format(metrics.file_coverage, '.2f'),
                                                        "total_number_of_lines": str(metrics.num_line)},
                                            "functions": {trace_name + "_of_trace": format(metrics.avg_trace, '.2f'),
                                                        "total_number_of_lines": str(metrics.num_line)}}})
            metrics_dict.update(
                {filename: {"total_number_of_characters": 0, "total_number_of_lines": str(metrics.num_line)}})

        tree_json = {"summary": {"python": {"code_patterns": code_patterns, "metrics": metrics_dict}}}

        with open(output_file, 'w') as f:
            json.dump(tree_json, f, indent=4)
            print("A file is made in " + output_file)
        
    def get_json_file(self, repository_path) -> Dict:
        with open(repository_path, 'r') as f:
            complexity_dict = json.load(f)
        return complexity_dict
    
    def get_file_list(self) -> List[str]:
        top_dir = PathBuilder.get_top_dir()
        dir_list = os.listdir(os.path.join(top_dir, 'data'))
        return dir_list
            
            