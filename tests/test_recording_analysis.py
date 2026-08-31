import io
import wave
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import sessionmaker

from bass_tracker.db.models import AudioAsset, Base, PracticeTrack
from bass_tracker.db.session import create_database_engine
from bass_tracker.schemas import CalibrationCreate, RecordingMetadata
from bass_tracker.services.performance_analysis import AnalysisService, HistoryService
from bass_tracker.services.recording import RecordingService
from bass_tracker.services.storage import FileStorage


def wav_bytes() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(48000); audio.writeframes(b"\0\0" * 4800)
    return output.getvalue()


def test_recording_analysis_context_and_history(tmp_path: Path) -> None:
    engine = create_database_engine(f"sqlite:///{tmp_path / 'app.db'}"); Base.metadata.create_all(engine); session = sessionmaker(bind=engine, expire_on_commit=False)(); storage = FileStorage(tmp_path / "data", tmp_path / "temp")
    track = PracticeTrack(display_title="Track", bpm=120, time_signature_numerator=4, status="ready"); session.add(track); session.flush()
    reference_path = storage.data_root / "tracks" / str(track.id) / "assets" / "stem_bass.wav"; reference_path.parent.mkdir(parents=True); reference_path.write_bytes(wav_bytes()); reference = AudioAsset(practice_track_id=track.id, asset_type="stem_bass", file_path=storage.relative(reference_path), format="wav", sample_rate_hz=48000, channels=1, duration_seconds=.1); session.add(reference); session.commit()
    service = RecordingService(session, storage); calibration = service.create_calibration(CalibrationCreate(input_device_id="in", output_device_id="out", sample_rate_hz=48000, roundtrip_latency_ms=25, calibration_method="cable_loopback"))
    metadata = RecordingMetadata(practice_track_id=track.id, section_start_seconds=0, section_end_seconds=.1, playback_speed=1, count_in_bars=0, sample_rate_hz=48000, latency_calibration_id=calibration.id)
    import asyncio
    recording = asyncio.run(service.save_recording(UploadFile(filename="recording.wav", file=io.BytesIO(wav_bytes())), metadata))
    context, job = AnalysisService(session).start(recording.id)
    assert context.latency_offset_ms == 25 and job.status == "queued"
    history = HistoryService(session).list(track.id, 10, 0)
    assert history[0]["recording_session_id"] == recording.id and history[0]["result_id"] is None