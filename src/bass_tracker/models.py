from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class PracticeTrack(Base):
    __tablename__ = "practice_tracks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    display_title: Mapped[str] = mapped_column(String(200))
    song_title: Mapped[str | None] = mapped_column(String(200))
    artist_name: Mapped[str | None] = mapped_column(String(200))
    duration: Mapped[float | None] = mapped_column(Float)
    bpm: Mapped[float | None] = mapped_column(Float)
    time_signature: Mapped[str | None] = mapped_column(String(20))
    key: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="registered", index=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)

    media_sources: Mapped[list["MediaSource"]] = relationship(cascade="all, delete-orphan")
    audio_assets: Mapped[list["AudioAsset"]] = relationship(
        cascade="all, delete-orphan", foreign_keys="AudioAsset.practice_track_id"
    )
    processing_jobs: Mapped[list["ProcessingJob"]] = relationship(cascade="all, delete-orphan")
    recording_sessions: Mapped[list["RecordingSession"]] = relationship(cascade="all, delete-orphan")


class MediaSource(Base):
    __tablename__ = "media_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    practice_track_id: Mapped[str] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(30))
    source_url: Mapped[str | None] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(String(200))
    source_title: Mapped[str | None] = mapped_column(String(300))
    source_creator: Mapped[str | None] = mapped_column(String(200))
    source_creator_id: Mapped[str | None] = mapped_column(String(200))
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    source_duration: Mapped[float | None] = mapped_column(Float)
    source_metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class AudioAsset(Base):
    __tablename__ = "audio_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    practice_track_id: Mapped[str] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    origin_media_source_id: Mapped[str | None] = mapped_column(ForeignKey("media_sources.id", ondelete="SET NULL"))
    parent_asset_id: Mapped[str | None] = mapped_column(ForeignKey("audio_assets.id", ondelete="SET NULL"))
    asset_type: Mapped[str] = mapped_column(String(30), index=True)
    file_path: Mapped[str] = mapped_column(Text)
    format: Mapped[str | None] = mapped_column(String(20))
    sample_rate: Mapped[int | None] = mapped_column(Integer)
    channels: Mapped[int | None] = mapped_column(Integer)
    duration: Mapped[float | None] = mapped_column(Float)
    processing_method: Mapped[str | None] = mapped_column(String(100))
    processing_version: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    practice_track_id: Mapped[str] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    job_type: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    processor_name: Mapped[str | None] = mapped_column(String(100))
    processor_version: Mapped[str | None] = mapped_column(String(50))
    parameters_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    input_asset_ids: Mapped[list[str] | None] = mapped_column(JSON)
    output_asset_ids: Mapped[list[str] | None] = mapped_column(JSON)
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class RecordingSession(Base):
    __tablename__ = "recording_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    practice_track_id: Mapped[str] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    recording_file_path: Mapped[str] = mapped_column(Text)
    section_start: Mapped[float | None] = mapped_column(Float)
    section_end: Mapped[float | None] = mapped_column(Float)
    playback_speed: Mapped[float] = mapped_column(Float, default=1.0)
    count_in_bars: Mapped[int] = mapped_column(Integer, default=0)
    sample_rate: Mapped[int | None] = mapped_column(Integer)
    audio_input_device_id: Mapped[str | None] = mapped_column(String(300))
    audio_output_device_id: Mapped[str | None] = mapped_column(String(300))
    latency_calibration_id: Mapped[str | None] = mapped_column(String(36))
    recorded_at: Mapped[datetime] = mapped_column(default=utc_now)
