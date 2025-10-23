import logging
from typing import List

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, Query, File, Form
from fastapi.responses import JSONResponse

from models.common_response import CommonResponse
from services.coverage_processor import CoverageProcessor
from services.file_manager.file_manager_s3_service import FileManagerS3Service
from services.file_manager.file_manager_local_service import FileManagerLocalService
from dependency_injector.wiring import inject, Provide
from containers import Container


coverall_router = APIRouter(prefix='/coverall')


@coverall_router.get('/project/list')
@inject
async def get_project_list(file_manager_s3_service: FileManagerS3Service = Depends(Provide[Container.file_manager_s3_service])):
    return file_manager_s3_service.get_project_list()


@coverall_router.get('/project/{project_name}')
@inject
async def get_complexity(project_name, file_manager_s3_service: FileManagerS3Service = Depends(Provide[Container.file_manager_s3_service])):
    json_data = file_manager_s3_service.get_complexity(
        f"{project_name}")
    json_data.pop("block", None)
    return JSONResponse(json_data)


@coverall_router.post("/project/{project_name}", status_code=status.HTTP_201_CREATED)
@inject
async def create_project_complexity(
    project_name: str,
    files: List[UploadFile] = File(...),
    project_identifier: str = Form(..., alias="projectIdentifier"),
    start: bool = Query(False),
    finalize: bool = Query(False),
    coverage: CoverageProcessor = Depends(Provide[Container.coverage_processor_service]),
    filemgr: FileManagerLocalService = Depends(Provide[Container.file_manager_local_service]),
):
    logging.info(f"Creating project {project_name} with identifier {project_identifier}")
    try:
        if start:
            filemgr.clear_staging(project_name)
        if not files:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No files uploaded")

        logging.info(f"Uploading {len(files)} files...")
        await filemgr.stage_batch(project_name, files)

        if not finalize:
            return CommonResponse(True, "Batch accepted").to_json()

        logging.info("Finalized")
        staged = await filemgr.get_staged_uploadfiles(project_name)
        if not staged:
            raise HTTPException(400, "No staged files found to finalize")
        await coverage.process_coverage(staged, project_name)

        filemgr.clear_staging(project_name)

        return CommonResponse(True, "Created coverage report").to_json()

    except HTTPException as e:
        raise
    except Exception as e:
        logging.error(e, exc_info=e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server error while processing project '{project_name}': {e}",
        )
