from dependency_injector import containers, providers
from configs.trace_config import TraceConfig
from configs.S3_config import S3Config
from minio import Minio

from repositories.file_manager_local_repository import FileManagerLocalRepository
from services.file_manager.file_manager_local_service import FileManagerLocalService
from repositories.trace_extractor_repository import TraceExtractorRepository
from services.coverage_processor import CoverageProcessor
from repositories.file_manager_s3_repository import FileManagerS3Repository
from services.file_manager.file_manager_s3_service import FileManagerS3Service
from services.trace_extractor import TraceExtractor
from util.request import Request

class Container(containers.DeclarativeContainer):
    
    wiring_config = containers.WiringConfiguration(modules=["routers.coverall_router"])
    
    s3_config = S3Config()
    trace_config = TraceConfig()
    request = Request()

    minio_client = providers.Singleton(
        Minio,
        endpoint=s3_config.get_endpoint_url,
        access_key=s3_config.get_user_name,
        secret_key=s3_config.get_password,
        secure=False
    )

    trace_extractor_repository = providers.Singleton(
        TraceExtractorRepository,
        trace_config
    )

    trace_extractor_service = providers.Factory(
        TraceExtractor,
        trace_extractor_repository,
        trace_config
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

    file_manager_local_repository = providers.Factory(
        FileManagerLocalRepository,
    )

    file_manager_local_service = providers.Factory(
        FileManagerLocalService,
        file_manager_local_repository,
    )

    coverage_processor_service = providers.Factory(
        CoverageProcessor,
        file_manager_s3_service,
        trace_extractor_service
    )