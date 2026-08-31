from pathlib import Path

from bass_tracker.services.commands import AudioCommands


class RecordingRunner:
    def __init__(self) -> None:
        self.commands: list[list[str]] = []

    def run(self, command: list[str]) -> str:
        self.commands.append(command)
        return ""


def test_demucs_separation_uses_configured_cuda_device(tmp_path: Path) -> None:
    source = tmp_path / "source.wav"
    output_root = tmp_path / "output"
    stem_dir = output_root / "htdemucs" / source.stem
    stem_dir.mkdir(parents=True)
    for name in ("bass", "drums", "vocals", "other"):
        (stem_dir / f"{name}.wav").touch()

    runner = RecordingRunner()
    AudioCommands(runner, demucs_device="cuda").separate(source, output_root, "htdemucs")

    assert runner.commands == [[
        "demucs", "--name", "htdemucs", "--out", str(output_root),
        "--device", "cuda", str(source),
    ]]