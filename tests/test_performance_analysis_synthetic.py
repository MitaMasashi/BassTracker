"""仕様13.22のSynthetic検証。ReferenceとUserを同一Onset Detectorへ通して評価する。"""

from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from audio_fixtures import bass_notes, write_wav
from bass_tracker.db.models import AnalysisResult, AudioAsset, Base, LatencyCalibration, NoteEvent, PracticeTrack, RecordingSession
from bass_tracker.db.session import create_database_engine
from bass_tracker.services.performance_analysis import AnalysisService, PerformanceAnalysisProcessor, count_in_duration, reference_recording_time
from bass_tracker.services.storage import FileStorage

REFERENCE_ONSETS = [1.0, 1.5, 2.0, 2.5]
SECTION_START = 0.9
SECTION_END = 3.0
BPM = 120.0
BEATS_PER_BAR = 4
TOLERANCE_MS = 10


def run_analysis(tmp_path: Path, user_onsets: list[float], *, playback_speed: float = 1.0, count_in_bars: int = 0, latency_ms: float = 0.0, user_amplitudes: list[float] | None = None, bpm_after_start: float | None = None) -> tuple[AnalysisResult, list[NoteEvent]]:
    tmp_path.mkdir(parents=True, exist_ok=True)
    engine = create_database_engine(f"sqlite:///{tmp_path / 'analysis.db'}")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    storage = FileStorage(tmp_path / "data", tmp_path / "temp")

    track = PracticeTrack(display_title="Synthetic", status="ready", bpm=BPM, time_signature_numerator=BEATS_PER_BAR, time_signature_denominator=4)
    session.add(track)
    session.flush()

    recording_seconds = max(user_onsets) + 1.0 if user_onsets else 3.2
    reference_path = write_wav(storage.data_root / "tracks" / str(track.id) / "stem_bass.wav", bass_notes(REFERENCE_ONSETS, duration=3.2))
    recording_path = write_wav(storage.data_root / "recordings" / str(track.id) / "recording.wav", bass_notes(user_onsets, amplitudes=user_amplitudes, duration=recording_seconds))
    reference = AudioAsset(practice_track_id=track.id, asset_type="stem_bass", file_path=storage.relative(reference_path), format="wav")
    recorded = AudioAsset(practice_track_id=track.id, asset_type="recording", file_path=storage.relative(recording_path), format="wav")
    session.add_all([reference, recorded])
    session.flush()

    calibration = None
    if latency_ms:
        calibration = LatencyCalibration(input_device_id="in", output_device_id="out", sample_rate_hz=48000, roundtrip_latency_ms=latency_ms, calibration_method="cable_loopback")
        session.add(calibration)
        session.flush()

    recording = RecordingSession(practice_track_id=track.id, recording_audio_asset_id=recorded.id, section_start_seconds=SECTION_START, section_end_seconds=SECTION_END, playback_speed=playback_speed, count_in_bars=count_in_bars, sample_rate_hz=48000, latency_calibration_id=calibration.id if calibration else None)
    session.add(recording)
    session.commit()

    _, job = AnalysisService(session).start(recording.id)
    if bpm_after_start is not None:
        track.bpm = bpm_after_start
        session.commit()
    PerformanceAnalysisProcessor(session, storage).run(job.id)
    session.commit()

    result = session.scalars(select(AnalysisResult)).one()
    events = list(session.scalars(select(NoteEvent).order_by(NoteEvent.event_index)))
    return result, events


def recording_times(playback_speed: float = 1.0, count_in_bars: int = 0, shift: float = 0.0) -> list[float]:
    count_in = count_in_duration(BPM, playback_speed, count_in_bars, BEATS_PER_BAR)
    return [reference_recording_time(onset, SECTION_START, playback_speed, count_in) + shift for onset in REFERENCE_ONSETS]


def test_reference_onsets_are_detected_from_synthetic_audio(tmp_path: Path) -> None:
    result, _ = run_analysis(tmp_path, recording_times())
    assert result.reference_note_count == len(REFERENCE_ONSETS)
    assert result.matched_note_count == len(REFERENCE_ONSETS)


def test_late_performance_reports_positive_timing_mean(tmp_path: Path) -> None:
    result, _ = run_analysis(tmp_path, recording_times(shift=0.030))
    assert result.timing_mean_ms == pytest.approx(30, abs=TOLERANCE_MS)
    assert result.timing_mae_ms == pytest.approx(30, abs=TOLERANCE_MS)


def test_early_performance_reports_negative_timing_mean(tmp_path: Path) -> None:
    result, _ = run_analysis(tmp_path, recording_times(shift=-0.020))
    assert result.timing_mean_ms == pytest.approx(-20, abs=TOLERANCE_MS)


def test_latency_calibration_cancels_recorded_offset(tmp_path: Path) -> None:
    result, _ = run_analysis(tmp_path, recording_times(shift=0.025), latency_ms=25)
    assert result.timing_mean_ms == pytest.approx(0, abs=TOLERANCE_MS)


def test_missing_note_is_reported(tmp_path: Path) -> None:
    times = recording_times()
    result, events = run_analysis(tmp_path, [times[0], times[1], times[3]])
    assert result.missing_note_count == 1
    assert any(event.status == "missing" and event.user_time_seconds is None for event in events)


def test_extra_note_is_reported(tmp_path: Path) -> None:
    times = recording_times()
    result, events = run_analysis(tmp_path, [*times, times[3] + 0.5])
    assert result.extra_note_count == 1
    assert any(event.status == "extra" and event.reference_time_seconds is None for event in events)


def test_half_speed_expands_reference_timeline(tmp_path: Path) -> None:
    times = recording_times(playback_speed=0.5)
    assert times[1] - times[0] == pytest.approx(1.0)
    result, _ = run_analysis(tmp_path, times, playback_speed=0.5)
    assert result.matched_note_count == len(REFERENCE_ONSETS)


def test_count_in_offset_is_applied(tmp_path: Path) -> None:
    times = recording_times(count_in_bars=2)
    assert times[0] == pytest.approx(count_in_duration(BPM, 1.0, 2, BEATS_PER_BAR) + 0.1)
    result, _ = run_analysis(tmp_path, times, count_in_bars=2)
    assert result.matched_note_count == len(REFERENCE_ONSETS)


def test_analysis_uses_track_snapshot_taken_when_job_starts(tmp_path: Path) -> None:
    times = recording_times(count_in_bars=1)
    result, _ = run_analysis(tmp_path, times, count_in_bars=1, bpm_after_start=60)
    assert result.matched_note_count == len(REFERENCE_ONSETS)


def test_uneven_dynamics_increase_level_spread(tmp_path: Path) -> None:
    times = recording_times()
    steady, _ = run_analysis(tmp_path / "steady", times, user_amplitudes=[0.6, 0.6, 0.6, 0.6])
    uneven, _ = run_analysis(tmp_path / "uneven", times, user_amplitudes=[0.15, 0.6, 0.2, 0.75])
    assert uneven.level_std_db > steady.level_std_db
    assert steady.level_std_db == pytest.approx(0, abs=1.0)


def test_silence_produces_no_matches(tmp_path: Path) -> None:
    result, _ = run_analysis(tmp_path, [])
    assert result.matched_note_count == 0
    assert result.extra_note_count == 0
    assert result.missing_note_count == result.reference_note_count
    assert result.timing_mean_ms is None
