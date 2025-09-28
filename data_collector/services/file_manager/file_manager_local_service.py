import shutil
from pathlib import Path
from tempfile import SpooledTemporaryFile

from fastapi import UploadFile
from repositories.file_manager_local_repository import FileManagerLocalRepository
from util.path import PathBuilder, is_path_valid
from services.file_manager.file_manager_service_abstract import FileManagerServiceAbstract
from typing import Dict, List


class FileManagerLocalService(FileManagerServiceAbstract):

    def __init__(self, file_manager: FileManagerLocalRepository) -> None:
        self.__file_manager = file_manager

    def save_complexity(self, repository_name, tree_json) -> None:
        pb = PathBuilder(repository_name)
        output_file = pb.top_dir + '/data/' + pb.project_name + '_complexity.json'
        self.__file_manager.save_to_json(output_file, tree_json)

    def get_complexity(self, repository_name) -> Dict:
        pb = PathBuilder(repository_name)
        output_file = pb.top_dir + '/data/' + pb.project_name + '_complexity.json'
        return self.__file_manager.get_json_file(output_file)

    def get_project_list(self) -> List[str]:
        repo_name_list = []
        file_list = self.__file_manager.get_file_list()
        for file_name in file_list:
            repo_name = file_name.replace('_complexity.json', '')
            repo_name_list.append(repo_name)
        return repo_name_list

    async def stage_batch(self, repository_name: str, files: List[UploadFile]) -> None:
        """
        Save this batch under:
          {top}/tmp/{project}/{client_relative_path}
        No filtering. Path-safe.
        """
        pb = PathBuilder(repository_name)
        base = Path(f"{pb.top_dir}/tmp/{pb.project_name}")
        base.mkdir(parents=True, exist_ok=True)

        for uf in files:
            # Normalize and make path-safe (no absolute / traversal)
            rel = uf.filename.lstrip("/").replace("\\", "/")
            target = (base / rel).resolve()
            if not str(target).startswith(str(base.resolve())):
                # skip any path that would escape the base dir
                continue

            target.parent.mkdir(parents=True, exist_ok=True)

            # Stream write to disk
            with target.open("wb") as out:
                while True:
                    chunk = await uf.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            await uf.close()

    async def get_staged_uploadfiles(self, repository_name: str) -> List[UploadFile]:
        """
        Load all staged files back as UploadFile objects.
        """
        pb = PathBuilder(repository_name)
        base = Path(f"{pb.top_dir}/tmp/{pb.project_name}")
        if not base.exists():
            return []

        result: List[UploadFile] = []
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            # Use a spooled temp file so we don't load everything into RAM
            spooled = SpooledTemporaryFile(max_size=10 * 1024 * 1024, mode="w+b")
            with path.open("rb") as src:
                shutil.copyfileobj(src, spooled)
            spooled.seek(0)

            rel_name = str(path.relative_to(base)).replace("\\", "/")
            result.append(UploadFile(file=spooled, filename=rel_name))

        return result

    def clear_staging(self, repository_name: str) -> None:
        """Remove the temp area after finalize (or on failure cleanup)."""
        pb = PathBuilder(repository_name)
        base = Path(f"{pb.top_dir}/tmp/{pb.project_name}")
        if base.exists():
            shutil.rmtree(base, ignore_errors=True)

