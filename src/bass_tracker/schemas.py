from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


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


class ImportAccepted(BaseModel):
    practice_track_id: int
    processing_job_id: int


class YouTubeMetadataRequest(BaseModel):
    url: HttpUrl


class YouTubeImportRequest(YouTubeMetadataRequest):
    display_title: str = Field(min_length=1, max_length=200)
    song_title: str | None = None
    artist_name: str | None = None


class AudioAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    practice_track_id: int
    asset_type: str
    file_path: str
    format: str
    sample_rate_hz: int | None
    channels: int | None
    duration_seconds: float | None


class MusicalAnalysisResponse(BaseModel):
    bpm: float | None
    musical_key: str | None
    time_signature: dict[str, int | None]
    assets: dict[str, int]


class ChordPatch(BaseModel):
    selected_chord: str | None = Field(None, min_length=1, max_length=50)
    start_seconds: float | None = Field(None, ge=0)
    end_seconds: float | None = Field(None, gt=0)


class ChordEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    start_seconds: float
    end_seconds: float
    detected_chord: str
    selected_chord: str
    confidence: float | None
    is_user_corrected: bool


class PitchPatch(BaseModel):
    selected_pitch: str = Field(min_length=1, max_length=20)
    selected_midi_note: int = Field(ge=0, le=127)


class PitchCandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    rank: int
    pitch: str
    midi_note: int
    frequency_hz: float
    score: float


class PitchEventResponse(BaseModel):
    id: int
    onset_seconds: float
    end_seconds: float | None
    selected_pitch: str | None
    selected_midi_note: int | None
    is_user_corrected: bool
    candidates: list[PitchCandidateResponse]


class CalibrationCreate(BaseModel):
    input_device_id: str
    output_device_id: str
    sample_rate_hz: int = Field(gt=0)
    browser_info: str | None = None
    roundtrip_latency_ms: float = Field(ge=0)
    calibration_method: str


class CalibrationResponse(CalibrationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    measured_at: datetime


class RecordingMetadata(BaseModel):
    practice_track_id: int
    section_start_seconds: float = Field(ge=0)
    section_end_seconds: float = Field(gt=0)
    playback_speed: float = Field(gt=0, le=2)
    count_in_bars: int = Field(ge=0, le=8)
    sample_rate_hz: int = Field(gt=0)
    audio_input_device_id: str | None = None
    audio_output_device_id: str | None = None
    latency_calibration_id: int | None = None


class RecordingSessionResponse(RecordingMetadata):
    model_config = ConfigDict(from_attributes=True)
    id: int
    recording_audio_asset_id: int
    recorded_at: datetime


class AnalysisAccepted(BaseModel):
    analysis_context_id: int
    processing_job_id: int


class AnalysisContextResponse(BaseModel):
    id: int
    recording_session_id: int
    reference_audio_asset_id: int
    reference_start_seconds: float
    reference_end_seconds: float
    playback_speed: float
    latency_offset_ms: float
    onset_detector: str
    analysis_version: str
    processing_job_id: int
    job_status: str | None
    analysis_result_id: int | None
    created_at: datetime


class AnalysisResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    analysis_context_id: int
    reference_note_count: int
    matched_note_count: int
    missing_note_count: int
    extra_note_count: int
    timing_mean_ms: float | None
    timing_mae_ms: float | None
    timing_std_ms: float | None
    level_mean_db: float | None
    level_std_db: float | None
    level_min_db: float | None
    level_max_db: float | None
    analysis_status: str
    analyzed_at: datetime


class NoteEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_index: int
    reference_time_seconds: float | None
    user_time_seconds: float | None
    timing_error_ms: float | None
    level_db: float | None
    status: str


class HistoryItem(BaseModel):
    recording_session_id: int
    recorded_at: datetime
    practice_track_id: int
    practice_track: str
    section_start_seconds: float
    section_end_seconds: float
    playback_speed: float
    result_id: int | None
    timing_mean_ms: float | None
    timing_mae_ms: float | None
    timing_std_ms: float | None
    level_std_db: float | None
    matched_note_count: int | None
    missing_note_count: int | None
    extra_note_count: int | None
