import lizard
class RepositoryAnalyzer:
    def __init__(self, pb):
        self.path_builder = pb

        pass

    def clone_repo(self):
        pass

    def get_all_filenames(self):
        all_files = list(lizard.analyze([self.path_builder.repo_path]))
        print(all_files)
        assert len(all_files) != 0, "Repository is empty or is not correctly cloned"
        return all_files
