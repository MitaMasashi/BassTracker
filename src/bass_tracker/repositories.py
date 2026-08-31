from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from bass_tracker.db.models import MediaSource, PracticeTrack, ProcessingJob


class PracticeTrackRepository:
    def __init__(self, session: Session): self.session = session
    def list(self, limit: int, offset: int, status: str | None = None, source_type: str | None = None, q: str | None = None) -> tuple[list[PracticeTrack], int]:
        query = select(PracticeTrack)
        if status: query = query.where(PracticeTrack.status == status)
        if source_type: query = query.where(PracticeTrack.id.in_(select(MediaSource.practice_track_id).where(MediaSource.source_type == source_type)))
        if q:
            pattern = f"%{q}%"
            query = query.where(or_(PracticeTrack.display_title.ilike(pattern), PracticeTrack.song_title.ilike(pattern), PracticeTrack.artist_name.ilike(pattern)))
        total = self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        return list(self.session.scalars(query.order_by(PracticeTrack.created_at.desc()).limit(limit).offset(offset))), total
    def get(self, track_id: int) -> PracticeTrack | None: return self.session.get(PracticeTrack, track_id)


class ProcessingJobRepository:
    def __init__(self, session: Session): self.session = session
    def get(self, job_id: int) -> ProcessingJob | None: return self.session.get(ProcessingJob, job_id)
    def list_for_track(self, track_id: int) -> list[ProcessingJob]: return list(self.session.scalars(select(ProcessingJob).where(ProcessingJob.practice_track_id == track_id).order_by(ProcessingJob.created_at.desc())))
    def next_queued(self) -> ProcessingJob | None: return self.session.scalar(select(ProcessingJob).where(ProcessingJob.status == "queued").order_by(ProcessingJob.created_at).limit(1))