from sqlalchemy.orm import Session

from bass_tracker.db.models import ProcessingJob
from bass_tracker.errors import AppError
from bass_tracker.repositories import PracticeTrackRepository, ProcessingJobRepository
from bass_tracker.schemas import TrackPatch
from bass_tracker.services.status import refresh_track_status


class TrackService:
    def __init__(self, session: Session): self.session, self.repo = session, PracticeTrackRepository(session)
    def list(self, limit: int, offset: int, status: str | None = None, source_type: str | None = None, q: str | None = None): return self.repo.list(limit, offset, status, source_type, q)
    def get(self, track_id: int):
        track = self.repo.get(track_id)
        if not track: raise AppError("TRACK_NOT_FOUND", "PracticeTrack was not found.", 404)
        return track
    def update(self, track_id: int, patch: TrackPatch):
        track = self.get(track_id)
        for key, value in patch.model_dump(exclude_unset=True).items(): setattr(track, key, value)
        self.session.commit(); refresh_track_status(self.session, track_id); self.session.refresh(track); return track


class JobService:
    def __init__(self, session: Session): self.session, self.repo = session, ProcessingJobRepository(session)
    def get(self, job_id: int):
        job = self.repo.get(job_id)
        if not job: raise AppError("JOB_NOT_FOUND", "ProcessingJob was not found.", 404)
        return job
    def list_for_track(self, track_id: int):
        TrackService(self.session).get(track_id); return self.repo.list_for_track(track_id)
    def retry(self, job_id: int):
        source = self.get(job_id)
        if source.status != "failed": raise AppError("JOB_NOT_RETRYABLE", "Only failed jobs can be retried.", 409)
        job = ProcessingJob(practice_track_id=source.practice_track_id, job_type=source.job_type, status="queued", processor_name=source.processor_name, processor_version=source.processor_version, parameters_json=source.parameters_json, retry_count=source.retry_count + 1)
        self.session.add(job); self.session.commit(); self.session.refresh(job); return job