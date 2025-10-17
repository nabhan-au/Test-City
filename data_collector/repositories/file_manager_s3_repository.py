from io import BytesIO

from mimetypes import guess_type
from fastapi import UploadFile
from minio import Minio, S3Error
from urllib3.response import HTTPResponse


class FileManagerS3Repository:
    bucket_name_default = 'json-files'

    def __init__(self, minio_client: Minio):
        self.__minio_client = minio_client

    def is_bucket_exists(self, bucket_name: str):
        return self.__minio_client.bucket_exists(bucket_name)
    
    def validate_bucket(self, bucket_name: str = bucket_name_default):
        if not self.is_bucket_exists(bucket_name):
            self.__minio_client.make_bucket(bucket_name)

    def upload_file(self, object_name: str, data: str, bucket_name: str = bucket_name_default):
        self.validate_bucket(bucket_name)
        self.__minio_client.put_object(bucket_name, f"{object_name}_complexity.json", data=BytesIO(data),
                                       length=len(data), content_type="application/json")

    def list_object(self, bucket_name: str = bucket_name_default):
        self.validate_bucket(bucket_name)
        return self.__minio_client.list_objects(bucket_name)
    
    def get_object(self, object_name: str, bucket_name: str = bucket_name_default):
        self.validate_bucket(bucket_name)
        try:
            response: HTTPResponse = self.__minio_client.get_object(bucket_name, f"{object_name}_complexity.json")
            response_data = response.data
            response.close()
            response.release_conn()
            return response_data
        except S3Error:
            return None

    async def upload_raw_file(self, file: UploadFile, object_name: str, bucket_name: str = bucket_name_default):
        self.validate_bucket(bucket_name)
        content = await file.read()
        guessed, _ = guess_type(file.filename or object_name)
        content_type = guessed or "application/octet-stream"
        self.__minio_client.put_object(
            bucket_name,
            object_name,
            data=BytesIO(content),
            length=len(content),
            content_type=content_type
        )
                
