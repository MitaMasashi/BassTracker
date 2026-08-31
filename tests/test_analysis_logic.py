import numpy as np
import pytest

from bass_tracker.services.performance_analysis import count_in_duration, event_level, match_events, reference_recording_time


def test_reference_timeline_accounts_for_speed_and_count_in() -> None:
    assert count_in_duration(120, 0.5, 2, 4) == 8
    assert reference_recording_time(81, 80, 0.5, 8) == 10


def test_matching_accounts_for_latency_missing_and_extra() -> None:
    matches = match_events([1, 2, 4], [1.055, 2.025, 3], latency_ms=25, tolerance_ms=80)
    assert matches[0].timing_error_ms == pytest.approx(30)
    assert matches[1].timing_error_ms == pytest.approx(0)
    assert matches[2].status == "missing"
    assert matches[3].status == "extra"


def test_level_uses_onset_window() -> None:
    audio = np.zeros(48000, dtype=np.float32)
    audio[4800:9600] = 0.5
    assert event_level(audio, 48000, 0.1, 100) == pytest.approx(-6.0206, abs=0.01)