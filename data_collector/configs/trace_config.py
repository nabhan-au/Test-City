from configs.config import Config

class TraceConfig(Config):

    def __init__(self) -> None:
        super().__init__()

    @property
    def get_url(self):
        return self.get_property('TRACE_SERVICE_URL')