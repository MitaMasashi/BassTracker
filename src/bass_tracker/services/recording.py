import shutil
import wave
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from bass_tracker.db.models import AudioAsset, LatencyCalibration, PracticeTrack, RecordingSession
from bass_tracker.errors import AppError
from bass_tracker.schemas import CalibrationCreate, RecordingMetadata
from bass_tracker.services.storage import FileStorage


class RecordingService:
    def __init__(self, session: Session, storage: FileStorage): self.session, self.storage = session, storage
    def create_calibration(self, request: CalibrationCreate) -> LatencyCalibration:
        calibration = LatencyCalibration(**request.model_dump()); self.session.add(calibration); self.session.commit(); self.session.refresh(calibration); return calibration
    def calibrations(self, input_id: str | None, output_id: str | None, sample_rate: int | None):
        query = select(LatencyCalibration)
        if input_id: query = query.where(LatencyCalibration.input_device_id == input_id)
        if output_id: query = query.where(LatencyCalibration.output_device_id == output_id)
        if sample_rate: query = query.where(LatencyCalibration.sample_rate_hz == sample_rate)
        return list(self.session.scalars(query.order_by(LatencyCalibration.measured_at.desc())))
    async def save_recording(self, upload: UploadFile, metadata: RecordingMetadata) -> RecordingSession:
        if metadata.section_end_seconds <= metadata.section_start_seconds: raise AppError("INVALID_SECTION", "section_end_seconds must be after section_start_seconds.", 422)
        if not self.session.get(PracticeTrack, metadata.practice_track_id): raise AppError("TRACK_NOT_FOUND", "PracticeTrack was not found.", 404)
        if metadata.latency_calibration_id and not self.session.get(LatencyCalibration, metadata.latency_calibration_id): raise AppError("CALIBRATION_NOT_FOUND", "LatencyCalibration was not found.", 404)
        path = self.storage.recording(metadata.practice_track_id, uuid4().hex)
        try:
            await self.storage.save_upload(upload, path, 1024 * 1024 * 1024)
            with wave.open(str(path), "rb") as wav:
                channels, sample_rate, frames = wav.getnchannels(), wav.getframerate(), wav.getnframes()
            if channels != 1: raise AppError("INVALID_RECORDING", "Recording WAV must be mono.", 400)
            asset = AudioAsset(practice_track_id=metadata.practice_track_id, asset_type="recording", file_path=self.storage.relative(path), format="wav", sample_rate_hz=sample_rate, channels=channels, duration_seconds=frames / sample_rate, processing_method="browser_pcm16")
            self.session.add(asset); self.session.flush(); recording = RecordingSession(recording_audio_asset_id=asset.id, **metadata.model_dump()); self.session.add(recording); self.session.commit(); self.session.refresh(recording); return recording
        except (wave.Error, EOFError) as exc:
            self.session.rollback(); path.unlink(missing_ok=True); raise AppError("INVALID_RECORDING", "Uploaded file is not a valid WAV.", 400) from exc
        except Exception:
            self.session.rollback(); path.unlink(missing_ok=True); raise
    def list_sessions(self, track_id: int | None, limit: int, offset: int):
        query = select(RecordingSession)
        if track_id: query = query.where(RecordingSession.practice_track_id == track_id)
        return list(self.session.scalars(query.order_by(RecordingSession.recorded_at.desc()).limit(limit).offset(offset)))
    def get_session(self, session_id: int):
        recording = self.session.get(RecordingSession, session_id)
        if not recording: raise AppError("RECORDING_SESSION_NOT_FOUND", "RecordingSession was not found.", 404)
        return recording