from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/app.db"
    data_root: Path = Path("./data/storage")
    temp_root: Path = Path("./data/tmp")
    ffmpeg_path: str | None = None
    ffprobe_path: str | None = None
    yt_dlp_path: str | None = None
    demucs_model: str | None = None
    demucs_path: str = "demucs"
    demucs_device: str | None = None
    cors_origins: str = "http://localhost:5173"
    log_level: str = "INFO"
    job_poll_interval: float = 1.0
    max_upload_bytes: int = 2 * 1024 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()