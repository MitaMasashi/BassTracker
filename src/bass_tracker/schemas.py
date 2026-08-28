from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PracticeTrackCreate(BaseModel):
    display_title: str = Field(min_length=1, max_length=200)
    song_title: str | None = None
    artist_name: str | None = None
    duration: float | None = Field(default=None, ge=0)
    bpm: float | None = Field(default=None, gt=0)
    time_signature: str | None = None
    key: str | None = None


class PracticeTrackUpdate(BaseModel):
    display_title: str | None = Field(default=None, min_length=1, max_length=200)
    song_title: str | None = None
    artist_name: str | None = None
    duration: float | None = Field(default=None, ge=0)
    bpm: float | None = Field(default=None, gt=0)
    time_signature: str | None = None
    key: str | None = None
    status: str | None = None


class PracticeTrackRead(ORMModel):
    id: str
    display_title: str
    song_title: str | None
    artist_name: str | None
    duration: float | None
    bpm: float | None
    time_signature: str | None
    key: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class MediaSourceCreate(BaseModel):
    practice_track_id: str
    source_type: str = Field(pattern="^(local_file|youtube|manual|soundcloud|spotify|apple_music|other)$")
    source_url: str | None = None
    external_id: str | None = None
    source_title: str | None = None
    source_creator: str | None = None
    source_creator_id: str | None = None
    thumbnail_url: str | None = None
    source_duration: float | None = Field(default=None, ge=0)
    source_metadata_json: dict[str, Any] | None = None


class MediaSourceRead(ORMModel):
    id: str
    practice_track_id: str
    source_type: str
    source_url: str | None
    external_id: str | None
    source_title: str | None
    source_creator: str | None
    source_creator_id: str | None
    thumbnail_url: str | None
    source_duration: float | None
    source_metadata_json: dict[str, Any] | None
    created_at: datetime


class AudioAssetCreate(BaseModel):
    practice_track_id: str
    origin_media_source_id: str | None = None
    parent_asset_id: str | None = None
    asset_type: str
    file_path: str
    format: str | None = None
    sample_rate: int | None = Field(default=None, gt=0)
    channels: int | None = Field(default=None, gt=0)
    duration: float | None = Field(default=None, ge=0)
    processing_method: str | None = None
    processing_version: str | None = None


class AudioAssetRead(ORMModel):
    id: str
    practice_track_id: str
    origin_media_source_id: str | None
    parent_asset_id: str | None
    asset_type: str
    file_path: str
    format: str | None
    sample_rate: int | None
    channels: int | None
    duration: float | None
    processing_method: str | None
    processing_version: str | None
    created_at: datetime


class ProcessingJobCreate(BaseModel):
    practice_track_id: str
    job_type: str
    processor_name: str | None = None
    processor_version: str | None = None
    parameters_json: dict[str, Any] | None = None
    input_asset_ids: list[str] | None = None


class ProcessingJobRead(ORMModel):
    id: str
    practice_track_id: str
    job_type: str
    status: str
    processor_name: str | None
    processor_version: str | None
    parameters_json: dict[str, Any] | None
    input_asset_ids: list[str] | None
    output_asset_ids: list[str] | None
    started_at: datetime | None
    finished_at: datetime | None
    error_code: str | None
    error_message: str | None
    retry_count: int
    created_at: datetime


class RecordingSessionCreate(BaseModel):
    practice_track_id: str
    recording_file_path: str
    section_start: float | None = Field(default=None, ge=0)
    section_end: float | None = Field(default=None, ge=0)
    playback_speed: float = Field(default=1.0, gt=0)
    count_in_bars: int = Field(default=0, ge=0)
    sample_rate: int | None = Field(default=None, gt=0)
    audio_input_device_id: str | None = None
    audio_output_device_id: str | None = None
    latency_calibration_id: str | None = None

    @model_validator(mode="after")
    def validate_section(self) -> "RecordingSessionCreate":
        if self.section_start is not None and self.section_end is not None and self.section_end <= self.section_start:
            raise ValueError("section_end must be greater than section_start")
        return self


class RecordingSessionRead(ORMModel):
    id: str
    practice_track_id: str
    recording_file_path: str
    section_start: float | None
    section_end: float | None
    playback_speed: float
    count_in_bars: int
    sample_rate: int | None
    audio_input_device_id: str | None
    audio_output_device_id: str | None
    latency_calibration_id: str | None
    recorded_at: datetime
