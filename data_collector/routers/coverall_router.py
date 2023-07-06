from fastapi import APIRouter, HTTPException, status
from services.coverall_generator import CoverallGenerator
from models.github_clone_repo_error import GithubCloneRepoError
from models.coverall_download_not_found import CoverallDownloadNotFound
from services.file_manager.file_manager_local_service import FileManagerLocalService
from repositories.file_manager_local_repository import FileManagerLocalRepository

coverall_router = APIRouter(prefix='/coverall')

# Use dependency injection to inject the service into the router laters
fileManagerLocalRepository = FileManagerLocalRepository()
fileManagerServiceLocal = FileManagerLocalService(fileManagerLocalRepository)

@coverall_router.get('/project/list')
async def get_project_list():
    return fileManagerServiceLocal.get_project_list()


@coverall_router.get('/project/{project_owner}/{project_name}')
async def get_coverall(project_owner, project_name):
    return fileManagerServiceLocal.get_complexity(project_owner + "/" + project_name)


@coverall_router.post('/project/{project_owner}/{project_name}', status_code=status.HTTP_201_CREATED)
async def create_project_coverall(project_owner, project_name):
    repository_name = project_owner + "/" + project_name
    try:
        CoverallGenerator(file_manager_service=fileManagerServiceLocal).generate_repository_data(repository_name)
    except GithubCloneRepoError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't clone repository with repository name: " + repository_name)
    except CoverallDownloadNotFound:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't download coverall with repository name: " + repository_name)
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Something went wrong in the server with message", e)
