from configs.config import Config

class TraceConfig(Config):

    def __init__(self) -> None:
        super().__init__()

    @property
    def get_jar_file_path(self):
        return self.get_property('jar_file_path')