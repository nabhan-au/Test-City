from dependency_injector import containers, providers
from repositories.file_manager_s3_repository import FileManagerS3Repository
from configs.S3_config import S3Config
from minio import Minio
from services.file_manager.file_manager_local_service import FileManagerLocalService
from repositories.file_manager_local_repository import FileManagerLocalRepository
from repositories.file_manager_s3_repository import FileManagerS3Repository
from services.file_manager.file_manager_s3_service import FileManagerS3Service
from services.coverall_generator import CoverallGenerator
from services.coverall.downloads import CoverallDownloader
from util.request import Request

class Container(containers.DeclarativeContainer):
    
    wiring_config = containers.WiringConfiguration(modules=["routers.coverall_router"])
    
    s3_config = S3Config()
    request = Request()
    
    minio_client = providers.Singleton(
        Minio,
        s3_config.get_endpoint_url,
        access_key=s3_config.get_access_key,
        secret_key=s3_config.get_secret_key,
        secure=False
    )
    
    coverall_downloader = providers.Factory(
        CoverallDownloader,
        Request
    )
    
    file_manager_s3_repository = providers.Factory(
        FileManagerS3Repository,
        minio_client,
    )
    
    file_manager_s3_service = providers.Factory(
        FileManagerS3Service,
        file_manager_s3_repository,
        s3_config.get_bucket_name
    )
    
    coverall_gernerator_service = providers.Factory(
        CoverallGenerator,
        file_manager_s3_service,
        coverall_downloader
    )