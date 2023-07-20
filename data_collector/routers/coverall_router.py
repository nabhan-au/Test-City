from fastapi import APIRouter, HTTPException, status, Depends
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
from dependency_injector.wiring import inject, Provide
from containers import Container


coverall_router = APIRouter(prefix='/coverall')


@coverall_router.get('/project/list')
@inject
async def get_project_list(file_manager_s3_service: FileManagerS3Service = Depends(Provide[Container.file_manager_s3_service])):
    return file_manager_s3_service.get_project_list()


@coverall_router.get('/project/{project_owner}/{project_name}')
@inject
async def get_coverall(project_owner, project_name, file_manager_s3_service: FileManagerS3Service = Depends(Provide[Container.file_manager_s3_service])):
    json_data = file_manager_s3_service.get_complexity(
        f"{project_owner}_{project_name}")
    return JSONResponse(json_data)


@coverall_router.post('/project/{project_owner}/{project_name}', status_code=status.HTTP_201_CREATED)
@inject
async def create_project_coverall(project_owner, project_name, coverall_gernerator_service: CoverallGenerator = Depends(Provide[Container.coverall_gernerator_service])):
    repository_name = project_owner + "/" + project_name
    try:
        await coverall_gernerator_service.generate_repository_data(
            repository_name)
    except GithubCloneRepoError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Can't clone repository with repository name: " + repository_name)
    except CoverallDownloadNotFound:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Can't download coverall with repository name: " + repository_name)
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "Something went wrong in the server with message", e)
