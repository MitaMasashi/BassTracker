from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from bass_tracker.api.routes import register_exception_handlers, router as api_router
from bass_tracker.config import Settings
from bass_tracker.database import Database
from bass_tracker.services.jobs import JobRunner
from bass_tracker.storage import FileStorage

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_environment()
    storage = FileStorage(settings.data_dir)
    database = Database(settings.database_url)
    job_runner = JobRunner(database)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        storage.initialize()
        database.create_tables()
        yield
        database.close()

    application = FastAPI(title="Bass Practice Lab", version="0.2.0", lifespan=lifespan)
    application.state.settings = settings
    application.state.storage = storage
    application.state.database = database
    application.state.job_runner = job_runner
    application.include_router(api_router, prefix="/api")
    application.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    register_exception_handlers(application)

    @application.get("/", include_in_schema=False)
    def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    @application.get("/health", tags=["system"])
    def health(request: Request) -> dict[str, str]:
        with request.app.state.database.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}

    return application


app = create_app()
