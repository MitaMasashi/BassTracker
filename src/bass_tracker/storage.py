from pathlib import Path
from uuid import uuid4


class FileStorage:
    DIRECTORY_MAP = {
        "source_audio": "audio/source",
        "stem_bass": "audio/stems/bass",
        "stem_drums": "audio/stems/drums",
        "stem_vocals": "audio/stems/vocals",
        "stem_other": "audio/stems/other",
        "bass_mute": "audio/bass_mute",
        "recording": "audio/recordings",
    }

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    def initialize(self) -> None:
        for relative_dir in ["db", "tmp", "uploads", *self.DIRECTORY_MAP.values()]:
            (self.root / relative_dir).mkdir(parents=True, exist_ok=True)

    def allocate(self, asset_type: str, suffix: str = ".wav") -> Path:
        relative_dir = self.DIRECTORY_MAP.get(asset_type)
        if relative_dir is None:
            raise ValueError(f"Unsupported asset type: {asset_type}")
        safe_suffix = suffix if suffix.startswith(".") else f".{suffix}"
        return self.root / relative_dir / f"{uuid4()}{safe_suffix}"

    def to_relative(self, path: Path) -> str:
        resolved = path.resolve()
        if not resolved.is_relative_to(self.root):
            raise ValueError("Storage path must be inside the configured data directory")
        return resolved.relative_to(self.root).as_posix()

    def resolve(self, relative_path: str) -> Path:
        resolved = (self.root / relative_path).resolve()
        if not resolved.is_relative_to(self.root):
            raise ValueError("Invalid storage path")
        return resolved
