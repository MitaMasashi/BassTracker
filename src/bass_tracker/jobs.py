from datetime import datetime, timezone
from typing import Protocol

from sqlalchemy.orm import Session

from bass_tracker.repositories import ProcessingJobRepository


class JobProcessor(Protocol):
    job_type: str
    def run(self, job_id: int) -> None: ...


class ProcessorRegistry:
    def __init__(self): self._processors: dict[str, JobProcessor] = {}
    def register(self, processor: JobProcessor) -> None: self._processors[processor.job_type] = processor
    def get(self, job_type: str) -> JobProcessor | None: return self._processors.get(job_type)


class Worker:
    def __init__(self, session: Session, registry: ProcessorRegistry): self.session, self.registry = session, registry
    def run_once(self) -> bool:
        job = ProcessingJobRepository(self.session).next_queued()
        if not job: return False
        job.status, job.started_at = "running", datetime.now(timezone.utc); self.session.commit()
        processor = self.registry.get(job.job_type)
        if not processor:
            job.status, job.error_code, job.error_message = "failed", "PROCESSOR_NOT_FOUND", f"No processor registered for {job.job_type}."
        else:
            try: processor.run(job.id); job.status = "succeeded"
            except Exception as exc: job.status, job.error_code, job.error_message = "failed", "PROCESSOR_FAILED", str(exc)
        job.finished_at = datetime.now(timezone.utc); self.session.commit(); return True