from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from bass_tracker.models import AudioAsset, Base, MediaSource, PracticeTrack, ProcessingJob, RecordingSession

ModelT = TypeVar("ModelT", bound=Base)


class Repository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, entity: ModelT) -> ModelT:
        self.session.add(entity)
        self.session.flush()
        return entity

    def get(self, entity_id: str) -> ModelT | None:
        return self.session.get(self.model, entity_id)

    def list(self, *, offset: int = 0, limit: int = 100) -> list[ModelT]:
        statement = select(self.model).offset(offset).limit(limit)
        return list(self.session.scalars(statement))

    def delete(self, entity: ModelT) -> None:
        self.session.delete(entity)
        self.session.flush()


class PracticeTrackRepository(Repository[PracticeTrack]):
    model = PracticeTrack


class MediaSourceRepository(Repository[MediaSource]):
    model = MediaSource

    def list_for_track(self, practice_track_id: str) -> list[MediaSource]:
        statement = select(MediaSource).where(MediaSource.practice_track_id == practice_track_id)
        return list(self.session.scalars(statement))


class AudioAssetRepository(Repository[AudioAsset]):
    model = AudioAsset

    def list_for_track(self, practice_track_id: str) -> list[AudioAsset]:
        statement = select(AudioAsset).where(AudioAsset.practice_track_id == practice_track_id)
        return list(self.session.scalars(statement))


class ProcessingJobRepository(Repository[ProcessingJob]):
    model = ProcessingJob

    def list_for_track(self, practice_track_id: str) -> list[ProcessingJob]:
        statement = (
            select(ProcessingJob)
            .where(ProcessingJob.practice_track_id == practice_track_id)
            .order_by(ProcessingJob.created_at.desc())
        )
        return list(self.session.scalars(statement))


class RecordingSessionRepository(Repository[RecordingSession]):
    model = RecordingSession

    def list_for_track(self, practice_track_id: str) -> list[RecordingSession]:
        statement = (
            select(RecordingSession)
            .where(RecordingSession.practice_track_id == practice_track_id)
            .order_by(RecordingSession.recorded_at.desc())
        )
        return list(self.session.scalars(statement))
