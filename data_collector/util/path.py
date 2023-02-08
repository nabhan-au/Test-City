import os


class PathBuilder:
    top_dir_name = "code-is-beautiful"

    def __init__(self, repository_name):
        current_path = os.path.dirname(os.path.abspath(__file__))
        if f"/{self.top_dir_name}/" not in current_path:
            print("Directory setting is wrongly modified")
            raise
        self.repository_name = repository_name
        self.project_name = repository_name.split('/')[-1]

        self.top_dir = join(current_path.split(self.top_dir_name)[0], self.top_dir_name)
        print(self.top_dir)
        self.visualizer_module = join(self.top_dir, "visualizer")
        self.data_collector_module = join(self.top_dir, "data_collector")
        self.top_repo_path = join(self.top_dir, "repo")
        self.repo_path = join(self.top_repo_path, self.project_name)

    def get_relative_filepath_from_repo(self, filename):
        return filename.replace(self.repo_path, '')[1:]


def join(base, directory_name):
    if base.endswith("/"):
        return base + directory_name
    return base + "/" + directory_name
