from sqlalchemy import func, select
from sqlalchemy.orm import Session

from bass_tracker.db.models import PracticeTrack, ProcessingJob


class PracticeTrackRepository:
    def __init__(self, session: Session): self.session = session
    def list(self, limit: int, offset: int) -> tuple[list[PracticeTrack], int]:
        return list(self.session.scalars(select(PracticeTrack).order_by(PracticeTrack.created_at.desc()).limit(limit).offset(offset))), self.session.scalar(select(func.count(PracticeTrack.id))) or 0
    def get(self, track_id: int) -> PracticeTrack | None: return self.session.get(PracticeTrack, track_id)


class ProcessingJobRepository:
    def __init__(self, session: Session): self.session = session
    def get(self, job_id: int) -> ProcessingJob | None: return self.session.get(ProcessingJob, job_id)
    def list_for_track(self, track_id: int) -> list[ProcessingJob]: return list(self.session.scalars(select(ProcessingJob).where(ProcessingJob.practice_track_id == track_id).order_by(ProcessingJob.created_at.desc())))
    def next_queued(self) -> ProcessingJob | None: return self.session.scalar(select(ProcessingJob).where(ProcessingJob.status == "queued").order_by(ProcessingJob.created_at).limit(1))