import lizard
import os
import git
import shutil

class RepositoryAnalyzer:
    def __init__(self, pb):
        self.path_builder = pb

    def clone_repo(self, commit_sha):
        if not os.path.isdir(self.path_builder.top_repo_path):
            os.mkdir(self.path_builder.top_repo_path)
        if not os.path.isdir(self.path_builder.repo_path):
            repo = git.Repo.clone_from('https://github.com/' + self.path_builder.repository_name,
                                       self.path_builder.repo_path)
            repo.git.checkout(commit_sha)

    def get_all_filenames(self):
        all_files = list(lizard.analyze([self.path_builder.repo_path]))
        print(all_files)
        assert len(all_files) != 0, "Repository is empty or is not correctly cloned"
        return all_files

    def remove_repo(self):
        if not os.path.isdir(self.path_builder.top_repo_path) or not os.path.isdir(self.path_builder.repo_path):
            return
        try:
            shutil.rmtree(self.path_builder.repo_path)
        except OSError as e:
            print("Error: ", self.path_builder.repo_path, " - ", e)
