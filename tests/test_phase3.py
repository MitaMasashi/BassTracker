import io
import wave
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from bass_tracker.db.models import AudioAsset, Base, MediaSource, PracticeTrack, ProcessingJob, ProcessingJobOutput
from bass_tracker.db.session import create_database_engine
from bass_tracker.jobs import ProcessorRegistry, Worker
from bass_tracker.services.commands import AudioInfo, CommandError
from bass_tracker.services.imports import ImportApplicationService, ImportJobProcessor
from bass_tracker.services.storage import FileStorage


class FakeAudioCommands:
    def probe(self, path: Path) -> AudioInfo:
        if path.suffix == ".txt":
            raise CommandError("AUDIO_STREAM_NOT_FOUND", "No audio stream.")
        return AudioInfo(48000, 2, 1.0)

    def convert(self, source: Path, destination: Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())

    def youtube_audio(self, url: str, destination_template: Path) -> Path:
        output = destination_template.with_name(destination_template.name.replace("%(ext)s", "wav"))
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(wav_bytes())
        return output


def wav_bytes() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(48000); wav.writeframes(b"\0\0" * 48)
    return output.getvalue()


def make_context(tmp_path: Path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'phase3.db'}")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    return session, FileStorage(tmp_path / "data", tmp_path / "temp")


def test_local_import_creates_traced_source_audio(tmp_path: Path) -> None:
    session, storage = make_context(tmp_path)
    upload = UploadFile(filename="bass.wav", file=io.BytesIO(wav_bytes()))
    import asyncio
    track_id, job_id = asyncio.run(ImportApplicationService(session, storage).register_local(upload, "Bass", None, None))
    registry = ProcessorRegistry(); registry.register(ImportJobProcessor(session, storage, FakeAudioCommands()))
    assert Worker(session, registry).run_once()
    asset = session.scalar(select(AudioAsset).where(AudioAsset.practice_track_id == track_id))
    assert asset and asset.asset_type == "source_audio" and asset.origin_media_source_id
    assert storage.resolve(asset.file_path).is_file()
    assert session.get(ProcessingJob, job_id).status == "succeeded"
    assert session.scalar(select(ProcessingJobOutput).where(ProcessingJobOutput.processing_job_id == job_id))
    assert session.get(PracticeTrack, track_id).status == "partial"


def test_youtube_import_keeps_creator_separate_from_artist(tmp_path: Path) -> None:
    session, storage = make_context(tmp_path)
    track_id, job_id = ImportApplicationService(session, storage).register_youtube("https://youtu.be/demo", "Video", None, None, {"id": "demo", "title": "Video", "uploader": "Channel", "duration": 10.0})
    track = session.get(PracticeTrack, track_id)
    source = session.scalar(select(MediaSource).where(MediaSource.practice_track_id == track_id))
    assert track.artist_name is None and source.source_creator == "Channel"
    registry = ProcessorRegistry(); registry.register(ImportJobProcessor(session, storage, FakeAudioCommands()))
    assert Worker(session, registry).run_once()
    assert session.get(ProcessingJob, job_id).status == "succeeded"


def test_import_failure_preserves_command_error_code(tmp_path: Path) -> None:
    session, storage = make_context(tmp_path)
    track = PracticeTrack(display_title="Bad", status="processing")
    session.add(track); session.flush()
    source = MediaSource(practice_track_id=track.id, source_type="local_file", source_title="bad.txt")
    session.add(source); session.flush()
    path = storage.source_original(track.id, ".txt"); path.write_text("bad")
    job = ProcessingJob(practice_track_id=track.id, job_type="import", status="queued", processor_name="local_file", parameters_json=f'{{"source_id": {source.id}, "original_path": "{path.as_posix()}"}}')
    session.add(job); session.commit()
    registry = ProcessorRegistry(); registry.register(ImportJobProcessor(session, storage, FakeAudioCommands()))
    Worker(session, registry).run_once(); session.refresh(job)
    assert job.status == "failed" and job.error_code == "AUDIO_STREAM_NOT_FOUND"
    assert session.get(PracticeTrack, track.id).status == "error"