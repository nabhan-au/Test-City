import os


class PathBuilder:
    top_dir_name = "code-is-beautiful/data_collector"

    def __init__(self, repository_name):
        self.top_dir = self.get_top_dir()
        self.repository_name = repository_name
        self.project_name = repository_name.split('/')[-1]
        self.organization_name = repository_name.split('/')[0]
        print(self.top_dir)
        self.top_repo_path = join(self.top_dir, "clone_github_repo")
        self.repo_path = join(self.top_repo_path, self.project_name)

    @staticmethod
    def get_top_dir():
        current_path = os.path.dirname(os.path.abspath(__file__))
        if f"/{PathBuilder.top_dir_name}/" not in current_path:
            print("Directory setting is wrongly modified")
            raise
        top_dir = join(current_path.split(PathBuilder.top_dir_name)[0], PathBuilder.top_dir_name)
        return top_dir

    def get_relative_filepath_from_repo(self, filename):
        return filename.replace(self.repo_path, '')[1:]


def join(base, directory_name):
    if base.endswith("/"):
        return base + directory_name
    return base + "/" + directory_name

def is_path_valid(project_path: str, required_folder = ("/classes/", "/pit-reports/")):
     return any(folder in project_path for folder in required_folder)
