from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    database_url: str

    @classmethod
    def from_environment(cls) -> "Settings":
        data_dir = Path(os.getenv("BASS_TRACKER_DATA_DIR", Path.cwd() / "data")).resolve()
        database_url = os.getenv(
            "BASS_TRACKER_DATABASE_URL",
            f"sqlite:///{(data_dir / 'db' / 'bass_tracker.sqlite3').as_posix()}",
        )
        return cls(data_dir=data_dir, database_url=database_url)
