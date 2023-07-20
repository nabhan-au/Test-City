from routers.coverall_router import coverall_router
from configs.S3_config import S3Config
from containers import Container
from aiohttp import web

from fastapi import FastAPI

def create_app() -> FastAPI:
    container = Container()
    
    app = FastAPI()
    app.container = container
    app.include_router(coverall_router)
    return app

app = create_app()
