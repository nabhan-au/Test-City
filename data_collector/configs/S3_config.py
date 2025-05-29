from configs.config import Config

class S3Config(Config):
    
    def __init__(self) -> None:
        super().__init__()

    @property        
    def get_bucket_name(self):
        return self.get_property('S3_BUCKET_NAME')
    
    @property
    def get_access_key(self):
        return self.get_property('S3_ACCESS_KEY')

    @property
    def get_user_name(self):
        return self.get_property('S3_USER_NAME')

    @property
    def get_password(self):
        return self.get_property('S3_PASSWORD')
    
    @property
    def get_secret_key(self):
        return self.get_property('S3_SECRET_KEY')
    
    @property
    def get_region_name(self):
        return self.get_property('S3_REGION_NAME')
    
    @property
    def get_endpoint_url(self):
        return self.get_property('S3_ENDPOINT_URL')