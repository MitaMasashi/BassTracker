from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import inspect

from bass_tracker.config import Settings
from bass_tracker.main import create_app


def make_settings(tmp_path: Path) -> Settings:
    database_path = tmp_path / "db" / "test.sqlite3"
    return Settings(data_dir=tmp_path, database_url=f"sqlite:///{database_path.as_posix()}")


def test_startup_creates_tables_and_storage(tmp_path: Path) -> None:
    app = create_app(make_settings(tmp_path))
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok", "database": "ok"}
        tables = set(inspect(app.state.database.engine).get_table_names())

    assert {"practice_tracks", "media_sources", "audio_assets", "processing_jobs", "recording_sessions"} <= tables
    assert (tmp_path / "audio" / "source").is_dir()
    assert (tmp_path / "audio" / "stems" / "bass").is_dir()
    assert (tmp_path / "audio" / "recordings").is_dir()
    assert (tmp_path / "uploads").is_dir()
    assert (tmp_path / "tmp").is_dir()


def test_entity_api_and_job_error_management(tmp_path: Path) -> None:
    app = create_app(make_settings(tmp_path))
    with TestClient(app) as client:
        track_response = client.post("/api/practice-tracks", json={"display_title": "Test Song"})
        assert track_response.status_code == 201
        track = track_response.json()

        source_response = client.post("/api/media-sources", json={
            "practice_track_id": track["id"], "source_type": "local_file", "source_title": "test.wav",
        })
        assert source_response.status_code == 201
        source = source_response.json()

        asset_response = client.post("/api/audio-assets", json={
            "practice_track_id": track["id"], "origin_media_source_id": source["id"],
            "asset_type": "source_audio", "file_path": "audio/source/test.wav", "format": "wav",
        })
        assert asset_response.status_code == 201

        recording_response = client.post("/api/recording-sessions", json={
            "practice_track_id": track["id"], "recording_file_path": "audio/recordings/take.wav",
            "section_start": 10.0, "section_end": 20.0,
        })
        assert recording_response.status_code == 201

        job_response = client.post("/api/processing-jobs", json={
            "practice_track_id": track["id"], "job_type": "stem_separation",
            "input_asset_ids": [asset_response.json()["id"]],
        })
        assert job_response.status_code == 201
        job_id = job_response.json()["id"]

        assert client.post(f"/api/processing-jobs/{job_id}/run").status_code == 200
        failed_job = client.get(f"/api/processing-jobs/{job_id}").json()
        assert failed_job["status"] == "failed"
        assert failed_job["error_code"] == "ProcessorNotRegisteredError"

        assert client.post(f"/api/processing-jobs/{job_id}/retry").status_code == 200
        retried_job = client.get(f"/api/processing-jobs/{job_id}").json()
        assert retried_job["status"] == "failed"
        assert retried_job["retry_count"] == 1

        assert len(client.get("/api/practice-tracks").json()) == 1
        assert len(client.get(f"/api/media-sources?practice_track_id={track['id']}").json()) == 1
        assert len(client.get(f"/api/audio-assets?practice_track_id={track['id']}").json()) == 1
        assert len(client.get(f"/api/recording-sessions?practice_track_id={track['id']}").json()) == 1


def test_index_is_served(tmp_path: Path) -> None:
    with TestClient(create_app(make_settings(tmp_path))) as client:
        response = client.get("/")
        assert response.status_code == 200
        assert "Bass Practice Lab" in response.text
