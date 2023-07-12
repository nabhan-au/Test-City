from routers.coverall_router import coverall_router
from configs.S3_config import S3Config

from fastapi import FastAPI

app = FastAPI()
config = S3Config()
app.include_router(coverall_router)

