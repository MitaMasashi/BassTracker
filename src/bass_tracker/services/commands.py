import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


class CommandError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class AudioInfo:
    sample_rate_hz: int
    channels: int
    duration_seconds: float


class CommandRunner:
    def run(self, command: list[str]) -> str:
        executable = shutil.which(command[0])
        if not executable:
            raise CommandError("COMMAND_NOT_FOUND", f"Required command was not found: {command[0]}")
        completed = subprocess.run([executable, *command[1:]], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if completed.returncode:
            raise CommandError("COMMAND_FAILED", completed.stderr[-2000:] or f"Command failed with code {completed.returncode}.")
        return completed.stdout


class AudioCommands:
    def __init__(self, runner: CommandRunner, ffmpeg: str = "ffmpeg", ffprobe: str = "ffprobe", yt_dlp: str = "yt-dlp", demucs: str = "demucs", demucs_device: str | None = None):
        self.runner, self.ffmpeg, self.ffprobe, self.yt_dlp, self.demucs, self.demucs_device = runner, ffmpeg, ffprobe, yt_dlp, demucs, demucs_device

    def probe(self, path: Path) -> AudioInfo:
        output = self.runner.run([self.ffprobe, "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate,channels:format=duration", "-of", "json", str(path)])
        data = json.loads(output)
        if not data.get("streams"):
            raise CommandError("AUDIO_STREAM_NOT_FOUND", "The file does not contain an audio stream.")
        stream = data["streams"][0]
        return AudioInfo(int(stream["sample_rate"]), int(stream["channels"]), float(data["format"]["duration"]))

    def convert(self, source: Path, destination: Path) -> None:
        self.runner.run([self.ffmpeg, "-y", "-i", str(source), "-vn", "-ar", "48000", "-c:a", "pcm_s16le", str(destination)])

    def youtube_metadata(self, url: str) -> dict[str, object]:
        return json.loads(self.runner.run([self.yt_dlp, "--dump-single-json", "--no-playlist", url]))

    def youtube_audio(self, url: str, destination_template: Path) -> Path:
        self.runner.run([self.yt_dlp, "--no-playlist", "-f", "bestaudio", "-o", str(destination_template), url])
        matches = list(destination_template.parent.glob(destination_template.name.replace("%(ext)s", "*")))
        if not matches:
            raise CommandError("DOWNLOAD_FAILED", "yt-dlp did not produce an audio file.")
        return matches[0]

    def separate(self, source: Path, output_root: Path, model: str) -> dict[str, Path]:
        command = [self.demucs, "--name", model, "--out", str(output_root)]
        if self.demucs_device:
            command.extend(["--device", self.demucs_device])
        command.append(str(source))
        self.runner.run(command)
        stem_dir = output_root / model / source.stem
        stems = {name: stem_dir / f"{name}.wav" for name in ("bass", "drums", "vocals", "other")}
        if not all(path.is_file() for path in stems.values()):
            raise CommandError("STEM_OUTPUT_MISSING", "Demucs did not produce all expected stems.")
        return stems

    def mix(self, sources: list[Path], destination: Path) -> None:
        command = [self.ffmpeg, "-y"]
        for source in sources: command.extend(["-i", str(source)])
        # normalize=0でStemの音量を保ち、PeakがClipする場合のみLimiterで抑える (仕様11.4)
        command.extend(["-filter_complex", f"amix=inputs={len(sources)}:normalize=0,alimiter=limit=0.891:level=false", "-c:a", "pcm_s16le", str(destination)])
        self.runner.run(command)