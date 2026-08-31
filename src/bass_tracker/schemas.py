from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TrackPatch(BaseModel):
    display_title: str | None = Field(None, min_length=1, max_length=200)
    song_title: str | None = None
    artist_name: str | None = None
    bpm: float | None = Field(None, gt=0)
    musical_key: str | None = None
    time_signature_numerator: int | None = Field(None, gt=0)
    time_signature_denominator: int | None = Field(None, gt=0)


class TrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    display_title: str
    song_title: str | None
    artist_name: str | None
    duration_seconds: float | None
    bpm: float | None
    musical_key: str | None
    status: str


class TrackListResponse(BaseModel):
    items: list[TrackResponse]
    total: int


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    practice_track_id: int
    job_type: str
    status: str
    processor_name: str | None
    processor_version: str | None
    parameters_json: str | None
    result_json: str | None
    error_code: str | None
    error_message: str | None
    retry_count: int
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime