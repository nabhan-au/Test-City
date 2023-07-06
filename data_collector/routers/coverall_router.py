from fastapi import APIRouter, HTTPException, status
from services.coverall_generator import CoverallGenerator
from models.github_clone_repo_error import GithubCloneRepoError
from models.coverall_download_not_found import CoverallDownloadNotFound

coverall_router = APIRouter(prefix='/coverall')


@coverall_router.get('/project/list')
async def get_project_list():
    return []


@coverall_router.get('/project/{project_owner}/{project_name}')
async def get_coverall(project_owner, project_name):
    return None


@coverall_router.post('/project/{project_owner}/{project_name}', status_code=status.HTTP_201_CREATED)
async def create_project_coverall(project_owner, project_name):
    repository_name = project_owner + "/" + project_name
    try:
        CoverallGenerator().generate_repository_data(repository_name)
    except GithubCloneRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't clone repository with repository name: ", repository_name, " with message: ", e)
    except CoverallDownloadNotFound as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Can't download coverall with repository name: ", repository_name, " with message: ", e)
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Something went wrong in the server with message", e)
