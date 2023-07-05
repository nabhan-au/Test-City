from routers.coverall_router import coverall_router

from fastapi import FastAPI

app = FastAPI()
app.include_router(coverall_router)
