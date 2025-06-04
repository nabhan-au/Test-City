from typing import List

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile
from fastapi.responses import JSONResponse

from models.common_response import CommonResponse
from services.coverage_processor import CoverageProcessor
from services.file_manager.file_manager_s3_service import FileManagerS3Service
from dependency_injector.wiring import inject, Provide
from containers import Container


coverall_router = APIRouter(prefix='/coverall')


@coverall_router.get('/project/list')
@inject
async def get_project_list(file_manager_s3_service: FileManagerS3Service = Depends(Provide[Container.file_manager_s3_service])):
    return file_manager_s3_service.get_project_list()


@coverall_router.get('/project/{project_name}')
@inject
async def get_coverall(project_name, file_manager_s3_service: FileManagerS3Service = Depends(Provide[Container.file_manager_s3_service])):
    json_data = file_manager_s3_service.get_complexity(
        f"{project_name}")
    return JSONResponse(json_data)


@coverall_router.post('/project/{project_name}', status_code=status.HTTP_201_CREATED)
@inject
async def create_project_coverall(project_name: str, files: List[UploadFile], coverage_processor: CoverageProcessor = Depends(Provide[Container.coverage_processor_service])):
    try:
        await coverage_processor.process_coverage(files, project_name)
        return CommonResponse(True, "Created coverage report").to_json()
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "Something went wrong in the server with message", e)
