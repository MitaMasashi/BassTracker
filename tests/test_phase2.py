from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session, sessionmaker

from bass_tracker.db.models import Base, PracticeTrack, ProcessingJob
from bass_tracker.db.session import create_database_engine, get_session
from bass_tracker.jobs import ProcessorRegistry, Worker
from bass_tracker.main import app


def make_session(tmp_path: Path) -> tuple[Session, object]:
    engine = create_database_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)(), engine


def test_schema_has_fourteen_tables_and_foreign_keys(tmp_path: Path) -> None:
    session, engine = make_session(tmp_path)
    assert len(inspect(engine).get_table_names()) == 14
    assert session.execute(text("PRAGMA foreign_keys")).scalar_one() == 1
    session.close()


def test_track_api_patch_errors_and_job_retry(tmp_path: Path) -> None:
    session, _ = make_session(tmp_path)
    track = PracticeTrack(display_title="Original", status="partial")
    session.add(track)
    session.flush()
    failed = ProcessingJob(practice_track_id=track.id, job_type="pitch_analysis", status="failed", parameters_json='{"fmin": 28}', retry_count=0)
    session.add(failed)
    session.commit()

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            assert client.get("/api/practice-tracks").json()["total"] == 1
            patched = client.patch(f"/api/practice-tracks/{track.id}", json={"display_title": "Updated"})
            assert patched.json()["display_title"] == "Updated"
            missing = client.get("/api/practice-tracks/999")
            assert missing.status_code == 404
            assert missing.json()["error"]["code"] == "TRACK_NOT_FOUND"
            retried = client.post(f"/api/jobs/{failed.id}/retry")
            assert retried.status_code == 202
            assert retried.json()["id"] != failed.id
            assert retried.json()["retry_count"] == 1
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_unknown_processor_fails_job_without_stopping_worker(tmp_path: Path) -> None:
    session, _ = make_session(tmp_path)
    track = PracticeTrack(display_title="Track", status="processing")
    session.add(track)
    session.flush()
    job = ProcessingJob(practice_track_id=track.id, job_type="unknown", status="queued")
    session.add(job)
    session.commit()
    worker = Worker(session, ProcessorRegistry())
    assert worker.run_once() is True
    session.refresh(job)
    assert job.status == "failed"
    assert job.error_code == "PROCESSOR_NOT_FOUND"
    assert worker.run_once() is False
    session.close()