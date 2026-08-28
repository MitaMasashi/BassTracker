from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from bass_tracker.api.dependencies import get_job_runner, get_session, get_storage
from bass_tracker.exceptions import EntityNotFoundError, InvalidStateError
from bass_tracker.schemas import (
    AudioAssetCreate, AudioAssetRead, MediaSourceCreate, MediaSourceRead,
    PracticeTrackCreate, PracticeTrackRead, PracticeTrackUpdate,
    ProcessingJobCreate, ProcessingJobRead, RecordingSessionCreate, RecordingSessionRead,
)
from bass_tracker.services.entities import (
    AudioAssetService, MediaSourceService, PracticeTrackService,
    ProcessingJobService, RecordingSessionService,
)
from bass_tracker.services.jobs import JobRunner
from bass_tracker.storage import FileStorage

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=500)]


@router.post("/practice-tracks", response_model=PracticeTrackRead, status_code=201, tags=["practice tracks"])
def create_practice_track(data: PracticeTrackCreate, session: SessionDep) -> Any:
    return PracticeTrackService(session).create(data)


@router.get("/practice-tracks", response_model=list[PracticeTrackRead], tags=["practice tracks"])
def list_practice_tracks(session: SessionDep, offset: Offset = 0, limit: Limit = 100) -> Any:
    return PracticeTrackService(session).list(offset, limit)


@router.get("/practice-tracks/{entity_id}", response_model=PracticeTrackRead, tags=["practice tracks"])
def get_practice_track(entity_id: str, session: SessionDep) -> Any:
    return PracticeTrackService(session).get(entity_id)


@router.patch("/practice-tracks/{entity_id}", response_model=PracticeTrackRead, tags=["practice tracks"])
def update_practice_track(entity_id: str, data: PracticeTrackUpdate, session: SessionDep) -> Any:
    return PracticeTrackService(session).update(entity_id, data)


@router.delete("/practice-tracks/{entity_id}", status_code=204, tags=["practice tracks"])
def delete_practice_track(entity_id: str, session: SessionDep) -> Response:
    PracticeTrackService(session).delete(entity_id)
    return Response(status_code=204)


@router.post("/media-sources", response_model=MediaSourceRead, status_code=201, tags=["media sources"])
def create_media_source(data: MediaSourceCreate, session: SessionDep) -> Any:
    return MediaSourceService(session).create(data)


@router.get("/media-sources", response_model=list[MediaSourceRead], tags=["media sources"])
def list_media_sources(session: SessionDep, practice_track_id: str | None = None, offset: Offset = 0, limit: Limit = 100) -> Any:
    return MediaSourceService(session).list(practice_track_id, offset, limit)


@router.get("/media-sources/{entity_id}", response_model=MediaSourceRead, tags=["media sources"])
def get_media_source(entity_id: str, session: SessionDep) -> Any:
    return MediaSourceService(session).get(entity_id)


@router.delete("/media-sources/{entity_id}", status_code=204, tags=["media sources"])
def delete_media_source(entity_id: str, session: SessionDep) -> Response:
    MediaSourceService(session).delete(entity_id)
    return Response(status_code=204)


@router.post("/audio-assets", response_model=AudioAssetRead, status_code=201, tags=["audio assets"])
def create_audio_asset(data: AudioAssetCreate, session: SessionDep) -> Any:
    return AudioAssetService(session).create(data)


@router.get("/audio-assets", response_model=list[AudioAssetRead], tags=["audio assets"])
def list_audio_assets(session: SessionDep, practice_track_id: str | None = None, offset: Offset = 0, limit: Limit = 100) -> Any:
    return AudioAssetService(session).list(practice_track_id, offset, limit)


@router.get("/audio-assets/{entity_id}", response_model=AudioAssetRead, tags=["audio assets"])
def get_audio_asset(entity_id: str, session: SessionDep) -> Any:
    return AudioAssetService(session).get(entity_id)


@router.delete("/audio-assets/{entity_id}", status_code=204, tags=["audio assets"])
def delete_audio_asset(entity_id: str, session: SessionDep) -> Response:
    AudioAssetService(session).delete(entity_id)
    return Response(status_code=204)


@router.post("/processing-jobs", response_model=ProcessingJobRead, status_code=201, tags=["processing jobs"])
def create_processing_job(data: ProcessingJobCreate, session: SessionDep) -> Any:
    return ProcessingJobService(session).create(data)


@router.get("/processing-jobs", response_model=list[ProcessingJobRead], tags=["processing jobs"])
def list_processing_jobs(session: SessionDep, practice_track_id: str | None = None, offset: Offset = 0, limit: Limit = 100) -> Any:
    return ProcessingJobService(session).list(practice_track_id, offset, limit)


@router.get("/processing-jobs/{entity_id}", response_model=ProcessingJobRead, tags=["processing jobs"])
def get_processing_job(entity_id: str, session: SessionDep) -> Any:
    return ProcessingJobService(session).get(entity_id)


@router.post("/processing-jobs/{entity_id}/run", response_model=ProcessingJobRead, tags=["processing jobs"])
def run_processing_job(entity_id: str, background_tasks: BackgroundTasks, session: SessionDep, runner: Annotated[JobRunner, Depends(get_job_runner)]) -> Any:
    job = ProcessingJobService(session).get(entity_id)
    if job.status != "queued":
        raise InvalidStateError("Only queued jobs can be run")
    background_tasks.add_task(runner.run, job.id)
    return job


@router.post("/processing-jobs/{entity_id}/retry", response_model=ProcessingJobRead, tags=["processing jobs"])
def retry_processing_job(entity_id: str, background_tasks: BackgroundTasks, runner: Annotated[JobRunner, Depends(get_job_runner)]) -> Any:
    job = runner.retry(entity_id)
    background_tasks.add_task(runner.run, job.id)
    return job


@router.post("/processing-jobs/{entity_id}/cancel", response_model=ProcessingJobRead, tags=["processing jobs"])
def cancel_processing_job(entity_id: str, runner: Annotated[JobRunner, Depends(get_job_runner)]) -> Any:
    return runner.cancel(entity_id)


@router.post("/recording-sessions", response_model=RecordingSessionRead, status_code=201, tags=["recording sessions"])
def create_recording_session(data: RecordingSessionCreate, session: SessionDep) -> Any:
    return RecordingSessionService(session).create(data)


@router.get("/recording-sessions", response_model=list[RecordingSessionRead], tags=["recording sessions"])
def list_recording_sessions(session: SessionDep, practice_track_id: str | None = None, offset: Offset = 0, limit: Limit = 100) -> Any:
    return RecordingSessionService(session).list(practice_track_id, offset, limit)


@router.get("/recording-sessions/{entity_id}", response_model=RecordingSessionRead, tags=["recording sessions"])
def get_recording_session(entity_id: str, session: SessionDep) -> Any:
    return RecordingSessionService(session).get(entity_id)


@router.delete("/recording-sessions/{entity_id}", status_code=204, tags=["recording sessions"])
def delete_recording_session(entity_id: str, session: SessionDep) -> Response:
    RecordingSessionService(session).delete(entity_id)
    return Response(status_code=204)


@router.get("/system/storage", tags=["system"])
def storage_info(storage: Annotated[FileStorage, Depends(get_storage)]) -> dict[str, object]:
    return {"root": str(storage.root), "directories": storage.DIRECTORY_MAP}


def register_exception_handlers(app: Any) -> None:
    @app.exception_handler(EntityNotFoundError)
    async def entity_not_found_handler(_, exc: EntityNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(InvalidStateError)
    async def invalid_state_handler(_, exc: InvalidStateError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(exc)})

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(_, __: IntegrityError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": "Database constraint violation"})

    @app.exception_handler(ValueError)
    async def value_error_handler(_, exc: ValueError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(exc)})
