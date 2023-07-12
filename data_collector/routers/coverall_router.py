from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from services.coverall_generator import CoverallGenerator
from models.github_clone_repo_error import GithubCloneRepoError
from models.coverall_download_not_found import CoverallDownloadNotFound
from services.file_manager.file_manager_local_service import FileManagerLocalService
from repositories.file_manager_local_repository import FileManagerLocalRepository
from repositories.file_manager_s3_repository import FileManagerS3Repository
from services.file_manager.file_manager_s3_service import FileManagerS3Service
from minio import Minio
from configs.S3_config import S3Config

s3_config = S3Config()
coverall_router = APIRouter(prefix='/coverall')
minio_client = Minio(s3_config.get_endpoint_url, access_key=s3_config.get_access_key, secret_key=s3_config.get_secret_key, secure=False)

# Use dependency injection to inject these service and repository into the router and please also change other service to use dependency injection
file_manager_local_repository = FileManagerLocalRepository()
file_manager_s3_repository = FileManagerS3Repository(minio_client)
file_manager_local_service = FileManagerLocalService(file_manager_local_repository)
file_manager_s3_service = FileManagerS3Service(file_manager_s3_repository)



@coverall_router.get('/project/list')
async def get_project_list():
    return file_manager_s3_service.get_project_list()


@coverall_router.get('/project/{project_owner}/{project_name}')
async def get_coverall(project_owner, project_name):
    json_data = file_manager_s3_service.get_complexity(f"{project_owner}_{project_name}")
    return JSONResponse(json_data)


@coverall_router.post('/project/{project_owner}/{project_name}', status_code=status.HTTP_201_CREATED)
async def create_project_coverall(project_owner, project_name):
    repository_name = project_owner + "/" + project_name
    try:
        CoverallGenerator(file_manager_s3_service).generate_repository_data(repository_name)
    except GithubCloneRepoError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't clone repository with repository name: " + repository_name)
    except CoverallDownloadNotFound:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't download coverall with repository name: " + repository_name)
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Something went wrong in the server with message", e)
