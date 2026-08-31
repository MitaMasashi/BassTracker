from collections.abc import Generator
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from bass_tracker.config import get_settings
from bass_tracker.db.models import Base


def create_database_engine(url: str | None = None) -> Engine:
    database_url = url or get_settings().database_url
    if database_url.startswith("sqlite:///") and ":memory:" not in database_url:
        Path(database_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(database_url, connect_args={"check_same_thread": False} if database_url.startswith("sqlite") else {})
    if database_url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(dbapi_connection: object, _: object) -> None:
            cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    return engine


engine = create_database_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def create_tables() -> None:
    Base.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session