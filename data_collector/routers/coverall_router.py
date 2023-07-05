from fastapi import APIRouter, HTTPException
from services.coverall_generator import generate_repository_data

coverall_router = APIRouter(prefix='/coverall')


@coverall_router.get('/project/list')
async def get_project_list():
    return []


@coverall_router.get('/project/{project_owner}/{project_name}')
async def get_coverall(project_owner, project_name):
    return None


@coverall_router.post('/project/{project_owner}/{project_name}')
async def create_project_coverall(project_owner, project_name):
    try:
        generate_repository_data(project_owner + "/" + project_name)
    except Exception as e:
        print(e)
