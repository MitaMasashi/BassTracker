from pathlib import Path

from sqlalchemy.orm import sessionmaker

from bass_tracker.db.models import AudioAsset, Base, PracticeTrack, ProcessingJob
from bass_tracker.db.session import create_database_engine
from bass_tracker.services.status import refresh_track_status


def make_session(tmp_path: Path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'status.db'}")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)()


def add_track(session, **values) -> int:
    track = PracticeTrack(display_title="Track", status="registered", **values)
    session.add(track)
    session.commit()
    return track.id


def add_asset(session, track_id: int, asset_type: str) -> None:
    session.add(AudioAsset(practice_track_id=track_id, asset_type=asset_type, file_path=f"{track_id}/{asset_type}.wav", format="wav"))
    session.commit()


def add_job(session, track_id: int, job_type: str, status: str) -> None:
    session.add(ProcessingJob(practice_track_id=track_id, job_type=job_type, status=status))
    session.commit()


def test_registered_until_any_job_starts(tmp_path: Path) -> None:
    session = make_session(tmp_path)
    track_id = add_track(session)
    assert refresh_track_status(session, track_id) == "registered"


def test_processing_while_jobs_are_pending(tmp_path: Path) -> None:
    session = make_session(tmp_path)
    track_id = add_track(session)
    add_job(session, track_id, "import", "queued")
    assert refresh_track_status(session, track_id) == "processing"


def test_error_when_import_failed_without_source_audio(tmp_path: Path) -> None:
    session = make_session(tmp_path)
    track_id = add_track(session)
    add_job(session, track_id, "import", "failed")
    assert refresh_track_status(session, track_id) == "error"


def test_partial_when_pitch_analysis_failed(tmp_path: Path) -> None:
    session = make_session(tmp_path)
    track_id = add_track(session, bpm=120.0, musical_key="E minor")
    for asset_type in ("source_audio", "stem_bass", "bass_mute"):
        add_asset(session, track_id, asset_type)
    for job_type in ("import", "stem_separation", "bpm_analysis", "key_analysis", "chord_analysis"):
        add_job(session, track_id, job_type, "succeeded")
    add_job(session, track_id, "pitch_analysis", "failed")
    assert refresh_track_status(session, track_id) == "partial"


def test_successful_retry_supersedes_failed_job_history(tmp_path: Path) -> None:
    session = make_session(tmp_path)
    track_id = add_track(session, bpm=120.0, musical_key="E minor")
    for asset_type in ("source_audio", "stem_bass", "bass_mute"):
        add_asset(session, track_id, asset_type)
    for job_type in ("import", "stem_separation", "bpm_analysis", "key_analysis", "chord_analysis"):
        add_job(session, track_id, job_type, "succeeded")
    add_job(session, track_id, "pitch_analysis", "failed")
    add_job(session, track_id, "pitch_analysis", "succeeded")

    assert refresh_track_status(session, track_id) == "ready"


def test_queued_retry_supersedes_failed_import_state(tmp_path: Path) -> None:
    session = make_session(tmp_path)
    track_id = add_track(session)
    add_job(session, track_id, "import", "failed")
    add_job(session, track_id, "import", "queued")

    assert refresh_track_status(session, track_id) == "processing"


def test_ready_requires_assets_metadata_and_analysis_jobs(tmp_path: Path) -> None:
    session = make_session(tmp_path)
    track_id = add_track(session, bpm=118.0, musical_key="E minor")
    for asset_type in ("source_audio", "stem_bass", "bass_mute"):
        add_asset(session, track_id, asset_type)
    for job_type in ("import", "stem_separation", "bpm_analysis", "key_analysis", "chord_analysis", "pitch_analysis"):
        add_job(session, track_id, job_type, "succeeded")
    assert refresh_track_status(session, track_id) == "ready"


def test_performance_analysis_does_not_reset_ready_track(tmp_path: Path) -> None:
    session = make_session(tmp_path)
    track_id = add_track(session, bpm=118.0, musical_key="E minor")
    for asset_type in ("source_audio", "stem_bass", "bass_mute"):
        add_asset(session, track_id, asset_type)
    for job_type in ("import", "stem_separation", "bpm_analysis", "key_analysis", "chord_analysis", "pitch_analysis"):
        add_job(session, track_id, job_type, "succeeded")
    add_job(session, track_id, "performance_analysis", "running")
    assert refresh_track_status(session, track_id) == "ready"
