from routers.coverall_router import coverall_router
from containers import Container
from fastapi.middleware.cors import CORSMiddleware


from fastapi import FastAPI
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from containers import Container
from routers.coverall_router import coverall_router  # adjust import if needed
import logging

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


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(filename)s:%(lineno)d - %(message)s",
    )

    logging.debug("Debug message")
    logging.info("Info message")
    logging.error("Error message")
    app = create_app()

    uvicorn.run(
        app,              # points to this file (main.py) and the app variable
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )