from collections.abc import Callable
from datetime import datetime, timezone
import logging

from bass_tracker.database import Database
from bass_tracker.exceptions import EntityNotFoundError, InvalidStateError, ProcessorNotRegisteredError
from bass_tracker.models import ProcessingJob
from bass_tracker.repositories import ProcessingJobRepository

logger = logging.getLogger(__name__)
JobHandler = Callable[[ProcessingJob], list[str] | None]


class JobRunner:
    """Runs registered processors and persists every job state transition."""

    def __init__(self, database: Database) -> None:
        self.database = database
        self.handlers: dict[str, JobHandler] = {}

    def register(self, job_type: str, handler: JobHandler) -> None:
        self.handlers[job_type] = handler

    def run(self, job_id: str) -> None:
        with self.database.session_factory() as session:
            repository = ProcessingJobRepository(session)
            job = repository.get(job_id)
            if job is None:
                logger.error("ProcessingJob disappeared before execution: %s", job_id)
                return
            if job.status != "queued":
                logger.warning("Ignoring execution of job %s in state %s", job.id, job.status)
                return
            job.status = "running"
            job.started_at = datetime.now(timezone.utc)
            job.finished_at = None
            job.error_code = None
            job.error_message = None
            session.commit()

            try:
                handler = self.handlers.get(job.job_type)
                if handler is None:
                    raise ProcessorNotRegisteredError(f"No processor registered for job type: {job.job_type}")
                job.output_asset_ids = handler(job)
                job.status = "succeeded"
            except Exception as exc:
                logger.exception("ProcessingJob failed: %s", job.id)
                job.status = "failed"
                job.error_code = type(exc).__name__
                job.error_message = str(exc)[:4000]
            finally:
                job.finished_at = datetime.now(timezone.utc)
                session.commit()

    def retry(self, job_id: str) -> ProcessingJob:
        with self.database.session_factory() as session:
            job = ProcessingJobRepository(session).get(job_id)
            if job is None:
                raise EntityNotFoundError("ProcessingJob", job_id)
            if job.status != "failed":
                raise InvalidStateError("Only failed jobs can be retried")
            job.status = "queued"
            job.retry_count += 1
            job.started_at = None
            job.finished_at = None
            job.error_code = None
            job.error_message = None
            session.commit()
            session.refresh(job)
            return job

    def cancel(self, job_id: str) -> ProcessingJob:
        with self.database.session_factory() as session:
            job = ProcessingJobRepository(session).get(job_id)
            if job is None:
                raise EntityNotFoundError("ProcessingJob", job_id)
            if job.status != "queued":
                raise InvalidStateError("Only queued jobs can be cancelled")
            job.status = "cancelled"
            job.finished_at = datetime.now(timezone.utc)
            session.commit()
            session.refresh(job)
            return job
