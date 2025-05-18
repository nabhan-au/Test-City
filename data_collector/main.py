from routers.coverall_router import coverall_router
from configs.S3_config import S3Config
from containers import Container
from fastapi.middleware.cors import CORSMiddleware


from fastapi import FastAPI

origins = ["*"]

def create_app() -> FastAPI:
    container = Container()
    
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.container = container
    app.include_router(coverall_router)
    return app

app = create_app()
