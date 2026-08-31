from datetime import datetime, timezone

from sqlalchemy import Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class PracticeTrack(TimestampMixin, Base):
    __tablename__ = "practice_tracks"
    id: Mapped[int] = mapped_column(primary_key=True)
    display_title: Mapped[str] = mapped_column(String(200))
    song_title: Mapped[str | None] = mapped_column(String(200))
    artist_name: Mapped[str | None] = mapped_column(String(200))
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    bpm: Mapped[float | None] = mapped_column(Float)
    time_signature_numerator: Mapped[int | None] = mapped_column(Integer)
    time_signature_denominator: Mapped[int | None] = mapped_column(Integer)
    musical_key: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="registered")
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)


class MediaSource(TimestampMixin, Base):
    __tablename__ = "media_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    practice_track_id: Mapped[int] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(30))
    source_url: Mapped[str | None] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(String(200), index=True)
    source_title: Mapped[str | None] = mapped_column(Text)
    source_creator: Mapped[str | None] = mapped_column(Text)
    source_creator_id: Mapped[str | None] = mapped_column(String(200))
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    source_duration_seconds: Mapped[float | None] = mapped_column(Float)
    source_metadata_json: Mapped[str | None] = mapped_column(Text)


class AudioAsset(TimestampMixin, Base):
    __tablename__ = "audio_assets"
    id: Mapped[int] = mapped_column(primary_key=True)
    practice_track_id: Mapped[int] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    origin_media_source_id: Mapped[int | None] = mapped_column(ForeignKey("media_sources.id", ondelete="SET NULL"))
    parent_asset_id: Mapped[int | None] = mapped_column(ForeignKey("audio_assets.id", ondelete="SET NULL"))
    asset_type: Mapped[str] = mapped_column(String(40))
    file_path: Mapped[str] = mapped_column(Text, unique=True)
    format: Mapped[str] = mapped_column(String(20))
    sample_rate_hz: Mapped[int | None] = mapped_column(Integer)
    channels: Mapped[int | None] = mapped_column(Integer)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    processing_method: Mapped[str | None] = mapped_column(String(100))
    processing_version: Mapped[str | None] = mapped_column(String(100))


class ProcessingJob(TimestampMixin, Base):
    __tablename__ = "processing_jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    practice_track_id: Mapped[int] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    job_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    processor_name: Mapped[str | None] = mapped_column(String(100))
    processor_version: Mapped[str | None] = mapped_column(String(100))
    parameters_json: Mapped[str | None] = mapped_column(Text)
    result_json: Mapped[str | None] = mapped_column(Text)
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(default=0)
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]


class ProcessingJobInput(Base):
    __tablename__ = "processing_job_inputs"
    processing_job_id: Mapped[int] = mapped_column(ForeignKey("processing_jobs.id", ondelete="CASCADE"), primary_key=True)
    audio_asset_id: Mapped[int] = mapped_column(ForeignKey("audio_assets.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str | None] = mapped_column(String(50))


class ProcessingJobOutput(Base):
    __tablename__ = "processing_job_outputs"
    processing_job_id: Mapped[int] = mapped_column(ForeignKey("processing_jobs.id", ondelete="CASCADE"), primary_key=True)
    audio_asset_id: Mapped[int] = mapped_column(ForeignKey("audio_assets.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str | None] = mapped_column(String(50))


class ChordEvent(TimestampMixin, Base):
    __tablename__ = "chord_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    practice_track_id: Mapped[int] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    processing_job_id: Mapped[int] = mapped_column(ForeignKey("processing_jobs.id", ondelete="CASCADE"))
    start_seconds: Mapped[float] = mapped_column(Float)
    end_seconds: Mapped[float] = mapped_column(Float)
    detected_chord: Mapped[str] = mapped_column(String(50))
    selected_chord: Mapped[str] = mapped_column(String(50))
    confidence: Mapped[float | None] = mapped_column(Float)
    is_user_corrected: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)


class PitchEvent(TimestampMixin, Base):
    __tablename__ = "pitch_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    practice_track_id: Mapped[int] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    processing_job_id: Mapped[int] = mapped_column(ForeignKey("processing_jobs.id", ondelete="CASCADE"))
    onset_seconds: Mapped[float] = mapped_column(Float)
    end_seconds: Mapped[float | None] = mapped_column(Float)
    selected_pitch: Mapped[str | None] = mapped_column(String(20))
    selected_midi_note: Mapped[int | None] = mapped_column(Integer)
    is_user_corrected: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)


class PitchCandidate(Base):
    __tablename__ = "pitch_candidates"
    pitch_event_id: Mapped[int] = mapped_column(ForeignKey("pitch_events.id", ondelete="CASCADE"), primary_key=True)
    rank: Mapped[int] = mapped_column(primary_key=True)
    pitch: Mapped[str] = mapped_column(String(20))
    midi_note: Mapped[int] = mapped_column(Integer)
    frequency_hz: Mapped[float] = mapped_column(Float)
    score: Mapped[float] = mapped_column(Float)


class LatencyCalibration(Base):
    __tablename__ = "latency_calibrations"
    id: Mapped[int] = mapped_column(primary_key=True)
    input_device_id: Mapped[str] = mapped_column(Text)
    output_device_id: Mapped[str] = mapped_column(Text)
    sample_rate_hz: Mapped[int] = mapped_column(Integer)
    browser_info: Mapped[str | None] = mapped_column(Text)
    roundtrip_latency_ms: Mapped[float] = mapped_column(Float)
    calibration_method: Mapped[str] = mapped_column(String(50))
    measured_at: Mapped[datetime] = mapped_column(default=utc_now)


class RecordingSession(Base):
    __tablename__ = "recording_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    practice_track_id: Mapped[int] = mapped_column(ForeignKey("practice_tracks.id", ondelete="CASCADE"), index=True)
    recording_audio_asset_id: Mapped[int] = mapped_column(ForeignKey("audio_assets.id", ondelete="RESTRICT"), unique=True)
    section_start_seconds: Mapped[float] = mapped_column(Float)
    section_end_seconds: Mapped[float] = mapped_column(Float)
    playback_speed: Mapped[float] = mapped_column(Float)
    count_in_bars: Mapped[int] = mapped_column(Integer)
    sample_rate_hz: Mapped[int] = mapped_column(Integer)
    audio_input_device_id: Mapped[str | None] = mapped_column(Text)
    audio_output_device_id: Mapped[str | None] = mapped_column(Text)
    latency_calibration_id: Mapped[int | None] = mapped_column(ForeignKey("latency_calibrations.id", ondelete="SET NULL"))
    recorded_at: Mapped[datetime] = mapped_column(default=utc_now)


class AnalysisContext(TimestampMixin, Base):
    __tablename__ = "analysis_contexts"
    id: Mapped[int] = mapped_column(primary_key=True)
    recording_session_id: Mapped[int] = mapped_column(ForeignKey("recording_sessions.id", ondelete="CASCADE"), index=True)
    reference_audio_asset_id: Mapped[int] = mapped_column(ForeignKey("audio_assets.id", ondelete="RESTRICT"))
    reference_start_seconds: Mapped[float] = mapped_column(Float)
    reference_end_seconds: Mapped[float] = mapped_column(Float)
    playback_speed: Mapped[float] = mapped_column(Float)
    latency_offset_ms: Mapped[float] = mapped_column(Float)
    onset_detector: Mapped[str] = mapped_column(String(100))
    onset_detector_version: Mapped[str] = mapped_column(String(100))
    analysis_version: Mapped[str] = mapped_column(String(100))
    parameters_json: Mapped[str | None] = mapped_column(Text)
    processing_job_id: Mapped[int] = mapped_column(ForeignKey("processing_jobs.id", ondelete="RESTRICT"))


class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_context_id: Mapped[int] = mapped_column(ForeignKey("analysis_contexts.id", ondelete="CASCADE"), unique=True)
    reference_note_count: Mapped[int] = mapped_column(Integer)
    matched_note_count: Mapped[int] = mapped_column(Integer)
    missing_note_count: Mapped[int] = mapped_column(Integer)
    extra_note_count: Mapped[int] = mapped_column(Integer)
    timing_mean_ms: Mapped[float | None] = mapped_column(Float)
    timing_mae_ms: Mapped[float | None] = mapped_column(Float)
    timing_std_ms: Mapped[float | None] = mapped_column(Float)
    level_mean_db: Mapped[float | None] = mapped_column(Float)
    level_std_db: Mapped[float | None] = mapped_column(Float)
    level_min_db: Mapped[float | None] = mapped_column(Float)
    level_max_db: Mapped[float | None] = mapped_column(Float)
    analysis_status: Mapped[str] = mapped_column(String(20))
    analyzed_at: Mapped[datetime] = mapped_column(default=utc_now)


class NoteEvent(Base):
    __tablename__ = "note_events"
    __table_args__ = (UniqueConstraint("analysis_result_id", "event_index"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_result_id: Mapped[int] = mapped_column(ForeignKey("analysis_results.id", ondelete="CASCADE"), index=True)
    event_index: Mapped[int] = mapped_column(Integer)
    reference_time_seconds: Mapped[float | None] = mapped_column(Float)
    user_time_seconds: Mapped[float | None] = mapped_column(Float)
    timing_error_ms: Mapped[float | None] = mapped_column(Float)
    level_db: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20))
    reference_pitch: Mapped[str | None] = mapped_column(String(20))
    detected_pitch: Mapped[str | None] = mapped_column(String(20))
    pitch_confidence: Mapped[float | None] = mapped_column(Float)
    reference_duration_seconds: Mapped[float | None] = mapped_column(Float)
    detected_duration_seconds: Mapped[float | None] = mapped_column(Float)