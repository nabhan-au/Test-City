from dependency_injector import containers, providers
from repositories.file_manager_s3_repository import FileManagerS3Repository
from configs.S3_config import S3Config
from minio import Minio
from services.file_manager.file_manager_local_service import FileManagerLocalService
from repositories.file_manager_local_repository import FileManagerLocalRepository
from repositories.file_manager_s3_repository import FileManagerS3Repository
from services.file_manager.file_manager_s3_service import FileManagerS3Service

class Container(containers.DeclarativeContainer):
    
    s3_config = S3Config()
    
    minio_client = providers.Singleton(
        Minio,
        s3_config.get_endpoint_url,
        access_key=s3_config.get_access_key,
        secret_key=s3_config.get_secret_key,
        secure=False
    )
    
    file_manager_s3_repository = providers.Singleton(
        FileManagerS3Repository,
        minio_client
    )
    
    file_manager_s3_service = providers.Singleton(
        FileManagerS3Service,
        file_manager_s3_repository
    )