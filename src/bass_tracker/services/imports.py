import json
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from bass_tracker.config import get_settings
from bass_tracker.db.models import AudioAsset, MediaSource, PracticeTrack, ProcessingJob, ProcessingJobOutput
from bass_tracker.errors import AppError
from bass_tracker.services.commands import AudioCommands, CommandError, CommandRunner
from bass_tracker.services.storage import FileStorage


class ImportApplicationService:
    def __init__(self, session: Session, storage: FileStorage): self.session, self.storage = session, storage

    async def register_local(self, upload: UploadFile, display_title: str, song_title: str | None, artist_name: str | None) -> tuple[int, int]:
        suffix = Path(upload.filename or "").suffix
        if suffix.lower() not in {".wav", ".mp3", ".m4a", ".flac"}: raise AppError("UNSUPPORTED_SOURCE", "Unsupported audio file extension.", 400)
        track = PracticeTrack(display_title=display_title, song_title=song_title or None, artist_name=artist_name or None, status="processing")
        self.session.add(track); self.session.flush()
        source = MediaSource(practice_track_id=track.id, source_type="local_file", source_title=upload.filename)
        self.session.add(source); self.session.flush()
        path = self.storage.source_original(track.id, suffix)
        try: size = await self.storage.save_upload(upload, path, get_settings().max_upload_bytes)
        except ValueError as exc: self.session.rollback(); raise AppError("UPLOAD_TOO_LARGE", str(exc), 400) from exc
        if size == 0: self.session.rollback(); path.unlink(missing_ok=True); raise AppError("EMPTY_FILE", "Uploaded file is empty.", 400)
        job = ProcessingJob(practice_track_id=track.id, job_type="import", status="queued", processor_name="local_file", parameters_json=json.dumps({"source_id": source.id, "original_path": str(path)}))
        self.session.add(job); self.session.commit(); return track.id, job.id

    def register_youtube(self, url: str, display_title: str, song_title: str | None, artist_name: str | None, metadata: dict[str, object]) -> tuple[int, int]:
        url = str(url)
        track = PracticeTrack(display_title=display_title, song_title=song_title, artist_name=artist_name, duration_seconds=metadata.get("duration"), status="processing")
        self.session.add(track); self.session.flush()
        source = MediaSource(practice_track_id=track.id, source_type="youtube", source_url=url, external_id=metadata.get("id"), source_title=metadata.get("title"), source_creator=metadata.get("uploader"), source_creator_id=metadata.get("channel_id"), thumbnail_url=metadata.get("thumbnail"), source_duration_seconds=metadata.get("duration"), source_metadata_json=json.dumps(metadata))
        self.session.add(source); self.session.flush()
        job = ProcessingJob(practice_track_id=track.id, job_type="import", status="queued", processor_name="youtube", parameters_json=json.dumps({"source_id": source.id, "url": url}))
        self.session.add(job); self.session.commit(); return track.id, job.id


class ImportJobProcessor:
    job_type = "import"
    def __init__(self, session: Session, storage: FileStorage, commands: AudioCommands): self.session, self.storage, self.commands = session, storage, commands
    def run(self, job_id: int) -> None:
        job = self.session.get(ProcessingJob, job_id)
        if not job: raise RuntimeError("Import job was not found.")
        params = json.loads(job.parameters_json or "{}")
        source = self.session.get(MediaSource, params["source_id"])
        if not source: raise RuntimeError("MediaSource was not found.")
        original = Path(params["original_path"]) if source.source_type == "local_file" else self.commands.youtube_audio(params["url"], self.storage.temp_root / f"youtube_{job.id}.%(ext)s")
        try:
            self.commands.probe(original)
            output = self.storage.source_audio(job.practice_track_id)
            self.commands.convert(original, output)
            info = self.commands.probe(output)
            asset = AudioAsset(practice_track_id=job.practice_track_id, origin_media_source_id=source.id, asset_type="source_audio", file_path=self.storage.relative(output), format="wav", sample_rate_hz=info.sample_rate_hz, channels=info.channels, duration_seconds=info.duration_seconds, processing_method="ffmpeg", processing_version="pcm_s16le_48k")
            self.session.add(asset); self.session.flush(); self.session.add(ProcessingJobOutput(processing_job_id=job.id, audio_asset_id=asset.id, role="source_audio"))
            for job_type in ("stem_separation", "bpm_analysis", "key_analysis", "chord_analysis"):
                self.session.add(ProcessingJob(practice_track_id=job.practice_track_id, job_type=job_type, status="queued", parameters_json=json.dumps({"source_asset_id": asset.id})))
            self.session.get(PracticeTrack, job.practice_track_id).status = "partial"
        except CommandError as exc:
            self.session.get(PracticeTrack, job.practice_track_id).status = "error"
            raise


def default_import_dependencies(session: Session) -> tuple[FileStorage, AudioCommands]:
    settings = get_settings()
    return FileStorage(settings.data_root, settings.temp_root), AudioCommands(CommandRunner(), settings.ffmpeg_path or "ffmpeg", settings.ffprobe_path or "ffprobe", settings.yt_dlp_path or "yt-dlp", settings.demucs_path, settings.demucs_device)


def list_assets(session: Session, track_id: int) -> list[AudioAsset]:
    return list(session.scalars(select(AudioAsset).where(AudioAsset.practice_track_id == track_id).order_by(AudioAsset.created_at)))