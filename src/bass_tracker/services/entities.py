from sqlalchemy.orm import Session

from bass_tracker.exceptions import EntityNotFoundError
from bass_tracker.models import AudioAsset, MediaSource, PracticeTrack, ProcessingJob, RecordingSession
from bass_tracker.repositories import (
    AudioAssetRepository,
    MediaSourceRepository,
    PracticeTrackRepository,
    ProcessingJobRepository,
    RecordingSessionRepository,
)
from bass_tracker.schemas import (
    AudioAssetCreate,
    MediaSourceCreate,
    PracticeTrackCreate,
    PracticeTrackUpdate,
    ProcessingJobCreate,
    RecordingSessionCreate,
)


class PracticeTrackService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = PracticeTrackRepository(session)

    def create(self, data: PracticeTrackCreate) -> PracticeTrack:
        entity = self.repository.add(PracticeTrack(**data.model_dump(), status="registered"))
        self.session.commit()
        return entity

    def get(self, entity_id: str) -> PracticeTrack:
        entity = self.repository.get(entity_id)
        if entity is None:
            raise EntityNotFoundError("PracticeTrack", entity_id)
        return entity

    def list(self, offset: int = 0, limit: int = 100) -> list[PracticeTrack]:
        return self.repository.list(offset=offset, limit=limit)

    def update(self, entity_id: str, data: PracticeTrackUpdate) -> PracticeTrack:
        entity = self.get(entity_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(entity, field, value)
        self.session.commit()
        return entity

    def delete(self, entity_id: str) -> None:
        self.repository.delete(self.get(entity_id))
        self.session.commit()


class MediaSourceService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = MediaSourceRepository(session)

    def create(self, data: MediaSourceCreate) -> MediaSource:
        PracticeTrackService(self.session).get(data.practice_track_id)
        entity = self.repository.add(MediaSource(**data.model_dump()))
        self.session.commit()
        return entity

    def get(self, entity_id: str) -> MediaSource:
        entity = self.repository.get(entity_id)
        if entity is None:
            raise EntityNotFoundError("MediaSource", entity_id)
        return entity

    def list(self, practice_track_id: str | None, offset: int, limit: int) -> list[MediaSource]:
        if practice_track_id:
            return self.repository.list_for_track(practice_track_id)
        return self.repository.list(offset=offset, limit=limit)

    def delete(self, entity_id: str) -> None:
        self.repository.delete(self.get(entity_id))
        self.session.commit()


class AudioAssetService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = AudioAssetRepository(session)

    def create(self, data: AudioAssetCreate) -> AudioAsset:
        PracticeTrackService(self.session).get(data.practice_track_id)
        if data.origin_media_source_id:
            source = MediaSourceService(self.session).get(data.origin_media_source_id)
            if source.practice_track_id != data.practice_track_id:
                raise ValueError("origin MediaSource belongs to another PracticeTrack")
        if data.parent_asset_id:
            parent = self.get(data.parent_asset_id)
            if parent.practice_track_id != data.practice_track_id:
                raise ValueError("parent AudioAsset belongs to another PracticeTrack")
        entity = self.repository.add(AudioAsset(**data.model_dump()))
        self.session.commit()
        return entity

    def get(self, entity_id: str) -> AudioAsset:
        entity = self.repository.get(entity_id)
        if entity is None:
            raise EntityNotFoundError("AudioAsset", entity_id)
        return entity

    def list(self, practice_track_id: str | None, offset: int, limit: int) -> list[AudioAsset]:
        if practice_track_id:
            return self.repository.list_for_track(practice_track_id)
        return self.repository.list(offset=offset, limit=limit)

    def delete(self, entity_id: str) -> None:
        self.repository.delete(self.get(entity_id))
        self.session.commit()


class ProcessingJobService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = ProcessingJobRepository(session)

    def create(self, data: ProcessingJobCreate) -> ProcessingJob:
        PracticeTrackService(self.session).get(data.practice_track_id)
        entity = self.repository.add(ProcessingJob(**data.model_dump(), status="queued"))
        self.session.commit()
        return entity

    def get(self, entity_id: str) -> ProcessingJob:
        entity = self.repository.get(entity_id)
        if entity is None:
            raise EntityNotFoundError("ProcessingJob", entity_id)
        return entity

    def list(self, practice_track_id: str | None, offset: int, limit: int) -> list[ProcessingJob]:
        if practice_track_id:
            return self.repository.list_for_track(practice_track_id)
        return self.repository.list(offset=offset, limit=limit)


class RecordingSessionService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = RecordingSessionRepository(session)

    def create(self, data: RecordingSessionCreate) -> RecordingSession:
        PracticeTrackService(self.session).get(data.practice_track_id)
        entity = self.repository.add(RecordingSession(**data.model_dump()))
        self.session.commit()
        return entity

    def get(self, entity_id: str) -> RecordingSession:
        entity = self.repository.get(entity_id)
        if entity is None:
            raise EntityNotFoundError("RecordingSession", entity_id)
        return entity

    def list(self, practice_track_id: str | None, offset: int, limit: int) -> list[RecordingSession]:
        if practice_track_id:
            return self.repository.list_for_track(practice_track_id)
        return self.repository.list(offset=offset, limit=limit)

    def delete(self, entity_id: str) -> None:
        self.repository.delete(self.get(entity_id))
        self.session.commit()
