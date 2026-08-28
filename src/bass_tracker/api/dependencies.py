from collections.abc import Iterator

from fastapi import Request
from sqlalchemy.orm import Session

from bass_tracker.services.jobs import JobRunner
from bass_tracker.storage import FileStorage


def get_session(request: Request) -> Iterator[Session]:
    with request.app.state.database.session_factory() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise


def get_job_runner(request: Request) -> JobRunner:
    return request.app.state.job_runner


def get_storage(request: Request) -> FileStorage:
    return request.app.state.storage
