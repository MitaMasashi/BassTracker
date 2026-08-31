from datetime import datetime, timezone
from typing import Protocol

from sqlalchemy.orm import Session

from bass_tracker.repositories import ProcessingJobRepository
from bass_tracker.services.commands import CommandError
from bass_tracker.services.status import refresh_track_status


class JobProcessor(Protocol):
    job_type: str
    def run(self, job_id: int) -> None: ...


class ProcessorRegistry:
    def __init__(self): self._processors: dict[str, JobProcessor] = {}
    def register(self, processor: JobProcessor) -> None: self._processors[processor.job_type] = processor
    def get(self, job_type: str) -> JobProcessor | None: return self._processors.get(job_type)


class Worker:
    def __init__(self, session: Session, registry: ProcessorRegistry): self.session, self.registry = session, registry

    def _record_failure(self, job_id: int, error_code: str, error_message: str) -> None:
        # Discard every DB mutation made by the processor before recording the
        # durable failure state in a fresh transaction.
        self.session.rollback()
        job = ProcessingJobRepository(self.session).get(job_id)
        if not job:
            raise RuntimeError(f"ProcessingJob {job_id} disappeared while handling a failure.")
        job.status = "failed"
        job.error_code = error_code
        job.error_message = error_message
        job.finished_at = datetime.now(timezone.utc)
        self.session.commit()

    def run_once(self) -> bool:
        job = ProcessingJobRepository(self.session).next_queued()
        if not job: return False
        job_id, track_id = job.id, job.practice_track_id
        job.status, job.started_at = "running", datetime.now(timezone.utc); self.session.commit()
        processor = self.registry.get(job.job_type)
        if not processor:
            self._record_failure(job_id, "PROCESSOR_NOT_FOUND", f"No processor registered for {job.job_type}.")
        else:
            try:
                processor.run(job_id)
                job = ProcessingJobRepository(self.session).get(job_id)
                if not job:
                    raise RuntimeError(f"ProcessingJob {job_id} disappeared while running.")
                job.status = "succeeded"
                job.finished_at = datetime.now(timezone.utc)
                self.session.commit()
            except CommandError as exc:
                self._record_failure(job_id, exc.code, str(exc))
            except Exception as exc:
                self._record_failure(job_id, "PROCESSOR_FAILED", str(exc))
        refresh_track_status(self.session, track_id)
        return True
