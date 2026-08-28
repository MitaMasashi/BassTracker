from fastapi.testclient import TestClient

from bass_tracker.main import app


client = TestClient(app)


def test_health() -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_index_is_served() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "Bass Practice Lab" in response.text
