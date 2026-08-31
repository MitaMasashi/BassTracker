import io
import json
import wave
from datetime import timedelta
from pathlib import Path

from fastapi import UploadFile
import pytest
from sqlalchemy.orm import sessionmaker

from bass_tracker.db.models import AnalysisContext, AnalysisResult, AudioAsset, Base, PracticeTrack, ProcessingJob
from bass_tracker.db.session import create_database_engine
from bass_tracker.errors import AppError
from bass_tracker.schemas import CalibrationCreate, RecordingMetadata
from bass_tracker.services.performance_analysis import AnalysisService, HistoryService
from bass_tracker.services.recording import RecordingService
from bass_tracker.services.storage import FileStorage


def wav_bytes(*, sample_rate: int = 48000, sample_width: int = 2) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1); audio.setsampwidth(sample_width); audio.setframerate(sample_rate); audio.writeframes(b"\0" * sample_width * 4800)
    return output.getvalue()


def test_recording_analysis_context_and_history(tmp_path: Path) -> None:
    engine = create_database_engine(f"sqlite:///{tmp_path / 'app.db'}"); Base.metadata.create_all(engine); session = sessionmaker(bind=engine, expire_on_commit=False)(); storage = FileStorage(tmp_path / "data", tmp_path / "temp")
    track = PracticeTrack(display_title="Track", bpm=120, time_signature_numerator=4, status="ready"); session.add(track); session.flush()
    reference_path = storage.data_root / "tracks" / str(track.id) / "assets" / "stem_bass.wav"; reference_path.parent.mkdir(parents=True); reference_path.write_bytes(wav_bytes()); reference = AudioAsset(practice_track_id=track.id, asset_type="stem_bass", file_path=storage.relative(reference_path), format="wav", sample_rate_hz=48000, channels=1, duration_seconds=.1); session.add(reference); session.commit()
    service = RecordingService(session, storage); calibration = service.create_calibration(CalibrationCreate(input_device_id="in", output_device_id="out", sample_rate_hz=48000, roundtrip_latency_ms=25, calibration_method="cable_loopback"))
    metadata = RecordingMetadata(practice_track_id=track.id, section_start_seconds=0, section_end_seconds=.1, playback_speed=1, count_in_bars=0, sample_rate_hz=48000, audio_input_device_id="in", audio_output_device_id="out", latency_calibration_id=calibration.id)
    import asyncio
    recording = asyncio.run(service.save_recording(UploadFile(filename="recording.wav", file=io.BytesIO(wav_bytes())), metadata))
    context, job = AnalysisService(session).start(recording.id)
    assert context.latency_offset_ms == 25 and job.status == "queued"
    parameters = json.loads(context.parameters_json)
    assert parameters["bpm"] == 120
    assert parameters["time_signature_numerator"] == 4
    assert parameters["count_in_duration_seconds"] == 0
    assert parameters["recording_sample_rate_hz"] == 48000
    history = HistoryService(session).list(track.id, 10, 0)
    assert history[0]["recording_session_id"] == recording.id and history[0]["result_id"] is None

    job.status = "succeeded"
    result = AnalysisResult(analysis_context_id=context.id, reference_note_count=1, matched_note_count=1, missing_note_count=0, extra_note_count=0, timing_mean_ms=5, timing_mae_ms=5, timing_std_ms=0, level_mean_db=-12, level_std_db=0, level_min_db=-12, level_max_db=-12, analysis_status="succeeded")
    session.add(result)
    session.flush()
    failed_job = ProcessingJob(practice_track_id=track.id, job_type="performance_analysis", status="failed")
    session.add(failed_job)
    session.flush()
    failed_context = AnalysisContext(recording_session_id=recording.id, reference_audio_asset_id=reference.id, reference_start_seconds=0, reference_end_seconds=.1, playback_speed=1, latency_offset_ms=25, onset_detector="librosa_onset", onset_detector_version="0.11", analysis_version="2", parameters_json="{}", processing_job_id=failed_job.id, created_at=context.created_at + timedelta(seconds=1))
    session.add(failed_context)
    session.commit()

    latest_success = HistoryService(session).list(track.id, 10, 0)[0]
    assert latest_success["result_id"] == result.id
    assert latest_success["matched_note_count"] == 1


def test_recording_rejects_non_pcm16_and_sample_rate_mismatch(tmp_path: Path) -> None:
    engine = create_database_engine(f"sqlite:///{tmp_path / 'validation.db'}"); Base.metadata.create_all(engine); session = sessionmaker(bind=engine, expire_on_commit=False)(); storage = FileStorage(tmp_path / "data", tmp_path / "temp")
    track = PracticeTrack(display_title="Track", status="ready"); session.add(track); session.commit()
    service = RecordingService(session, storage)
    metadata = RecordingMetadata(practice_track_id=track.id, section_start_seconds=0, section_end_seconds=1, playback_speed=1, count_in_bars=0, sample_rate_hz=48000)
    import asyncio

    with pytest.raises(AppError) as invalid_width:
        asyncio.run(service.save_recording(UploadFile(filename="recording.wav", file=io.BytesIO(wav_bytes(sample_width=1))), metadata))
    assert invalid_width.value.code == "INVALID_RECORDING"

    mismatched = metadata.model_copy(update={"sample_rate_hz": 44100})
    with pytest.raises(AppError) as invalid_rate:
        asyncio.run(service.save_recording(UploadFile(filename="recording.wav", file=io.BytesIO(wav_bytes())), mismatched))
    assert invalid_rate.value.code == "RECORDING_SAMPLE_RATE_MISMATCH"


def test_recording_rejects_mismatched_calibration(tmp_path: Path) -> None:
    engine = create_database_engine(f"sqlite:///{tmp_path / 'calibration.db'}"); Base.metadata.create_all(engine); session = sessionmaker(bind=engine, expire_on_commit=False)(); storage = FileStorage(tmp_path / "data", tmp_path / "temp")
    track = PracticeTrack(display_title="Track", status="ready"); session.add(track); session.commit()
    service = RecordingService(session, storage)
    calibration = service.create_calibration(CalibrationCreate(input_device_id="input-a", output_device_id="default", sample_rate_hz=48000, roundtrip_latency_ms=20, calibration_method="cable_loopback"))
    metadata = RecordingMetadata(practice_track_id=track.id, section_start_seconds=0, section_end_seconds=1, playback_speed=1, count_in_bars=0, sample_rate_hz=48000, audio_input_device_id="input-b", audio_output_device_id="default", latency_calibration_id=calibration.id)
    import asyncio

    with pytest.raises(AppError) as mismatch:
        asyncio.run(service.save_recording(UploadFile(filename="recording.wav", file=io.BytesIO(wav_bytes())), metadata))
    assert mismatch.value.code == "CALIBRATION_MISMATCH"
