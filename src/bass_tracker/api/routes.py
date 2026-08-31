from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from bass_tracker.db.session import get_session
from bass_tracker.schemas import JobResponse, TrackListResponse, TrackPatch, TrackResponse
from bass_tracker.services.core import JobService, TrackService

router = APIRouter()


DbSession = Annotated[Session, Depends(get_session)]


@router.get("/health", tags=["system"])
def health() -> dict[str, str]: return {"status": "ok"}


@router.get("/practice-tracks", response_model=TrackListResponse, tags=["practice tracks"])
def list_practice_tracks(session: DbSession, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)) -> TrackListResponse:
    items, total = TrackService(session).list(limit, offset); return TrackListResponse(items=items, total=total)


@router.get("/practice-tracks/{track_id}", response_model=TrackResponse, tags=["practice tracks"])
def get_practice_track(track_id: int, session: DbSession): return TrackService(session).get(track_id)


@router.patch("/practice-tracks/{track_id}", response_model=TrackResponse, tags=["practice tracks"])
def patch_practice_track(track_id: int, patch: TrackPatch, session: DbSession): return TrackService(session).update(track_id, patch)


@router.get("/practice-tracks/{track_id}/jobs", response_model=list[JobResponse], tags=["jobs"])
def list_jobs(track_id: int, session: DbSession): return JobService(session).list_for_track(track_id)


@router.get("/jobs/{job_id}", response_model=JobResponse, tags=["jobs"])
def get_job(job_id: int, session: DbSession): return JobService(session).get(job_id)


@router.post("/jobs/{job_id}/retry", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED, tags=["jobs"])
def retry_job(job_id: int, session: DbSession): return JobService(session).retry(job_id)
