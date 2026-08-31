"""Synthetic audio fixtures. `python tests/audio_fixtures.py` writes tests/fixtures/audio/."""

import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 48000
E1_HZ = 41.20
B0_HZ = 30.87
E2_HZ = 82.41
NOTE_SECONDS = 0.4


def bass_notes(onsets: list[float], amplitudes: list[float] | None = None, frequency: float = E2_HZ, duration: float | None = None, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
    """発音時刻が既知のベース音列。各Onsetに広帯域アタックを重ねてOnset検出を安定させる。"""
    levels = amplitudes or [0.6] * len(onsets)
    total = duration if duration is not None else (max(onsets) + NOTE_SECONDS + 0.2 if onsets else 1.0)
    audio = np.zeros(int(total * sample_rate), dtype=np.float64)
    noise = np.random.default_rng(7)
    for onset, amplitude in zip(onsets, levels):
        start = int(onset * sample_rate)
        length = min(int(NOTE_SECONDS * sample_rate), len(audio) - start)
        if length <= 0:
            continue
        time = np.arange(length) / sample_rate
        body = np.sin(2 * np.pi * frequency * time) + 0.5 * np.sin(4 * np.pi * frequency * time) + 0.25 * np.sin(8 * np.pi * frequency * time)
        attack = np.zeros(length)
        attack_length = min(int(0.005 * sample_rate), length)
        attack[:attack_length] = noise.normal(0, 1, attack_length) * np.linspace(1.0, 0.0, attack_length)
        audio[start:start + length] += amplitude * (body * np.exp(-time * 10) + attack)
    return np.clip(audio, -1.0, 1.0).astype(np.float32)


def silence(seconds: float = 1.0, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
    return np.zeros(int(seconds * sample_rate), dtype=np.float32)


def write_wav(path: Path, audio: np.ndarray, sample_rate: int = SAMPLE_RATE) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes((np.clip(audio, -1.0, 1.0) * 32767).astype("<i2").tobytes())
    return path


REFERENCE_ONSETS = [1.0, 1.5, 2.0, 2.5]

FIXTURES = {
    "bass_sine_notes.wav": lambda: bass_notes(REFERENCE_ONSETS),
    "bass_sine_notes_shifted_30ms.wav": lambda: bass_notes([value + 0.03 for value in REFERENCE_ONSETS]),
    "bass_missing_note.wav": lambda: bass_notes([1.0, 1.5, 2.5], duration=3.1),
    "bass_extra_note.wav": lambda: bass_notes([1.0, 1.5, 1.75, 2.0, 2.5]),
    "silence.wav": lambda: silence(3.1),
}


if __name__ == "__main__":
    target = Path(__file__).parent / "fixtures" / "audio"
    for name, build in FIXTURES.items():
        write_wav(target / name, build())
        print(f"wrote {target / name}")
