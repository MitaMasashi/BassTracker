from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from bass_tracker.api.routes import router as api_router
from bass_tracker.db.session import create_tables
from bass_tracker.errors import register_error_handlers

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    yield


app = FastAPI(title="Bass Practice Lab", version="0.1.0", lifespan=lifespan)
app.include_router(api_router, prefix="/api")
register_error_handlers(app)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    """Serve the single-page UI shell."""
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
