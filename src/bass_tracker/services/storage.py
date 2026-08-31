from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile


class FileStorage:
    def __init__(self, data_root: Path, temp_root: Path):
        self.data_root = data_root.resolve()
        self.temp_root = temp_root.resolve()
        self.data_root.mkdir(parents=True, exist_ok=True)
        self.temp_root.mkdir(parents=True, exist_ok=True)

    def source_original(self, track_id: int, suffix: str) -> Path:
        path = self.data_root / "tracks" / str(track_id) / "source" / f"original_{uuid4().hex}{suffix.lower()}"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def source_audio(self, track_id: int) -> Path:
        path = self.data_root / "tracks" / str(track_id) / "source" / "source_audio.wav"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    async def save_upload(self, upload: UploadFile, destination: Path, max_bytes: int) -> int:
        size = 0
        with destination.open("wb") as target:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    target.close()
                    destination.unlink(missing_ok=True)
                    raise ValueError("Upload exceeds configured size limit.")
                target.write(chunk)
        return size

    def relative(self, path: Path) -> str:
        return path.resolve().relative_to(self.data_root).as_posix()

    def resolve(self, relative_path: str) -> Path:
        path = (self.data_root / relative_path).resolve()
        if self.data_root not in path.parents:
            raise ValueError("Path escapes DATA_ROOT.")
        return path

    def recording(self, track_id: int, recording_id: str) -> Path:
        path = self.data_root / "recordings" / str(track_id) / f"recording_{recording_id}.wav"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path