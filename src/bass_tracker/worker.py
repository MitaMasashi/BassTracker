import logging
import time

from bass_tracker.config import get_settings
from bass_tracker.db.session import SessionLocal
from bass_tracker.jobs import ProcessorRegistry, Worker
from bass_tracker.services.imports import ImportJobProcessor, default_import_dependencies
from bass_tracker.services.musical_analysis import LibrosaAnalysisProcessor, StemSeparationProcessor
from bass_tracker.services.performance_analysis import PerformanceAnalysisProcessor


def run_once() -> bool:
    with SessionLocal() as session:
        storage, commands = default_import_dependencies(session)
        registry = ProcessorRegistry(); registry.register(ImportJobProcessor(session, storage, commands)); registry.register(StemSeparationProcessor(session, storage, commands))
        for job_type in ("bpm_analysis", "key_analysis", "chord_analysis", "pitch_analysis"):
            registry.register(LibrosaAnalysisProcessor(session, storage, job_type))
        registry.register(PerformanceAnalysisProcessor(session, storage))
        return Worker(session, registry).run_once()


def main() -> None:
    logging.basicConfig(level=get_settings().log_level)
    while True:
        if not run_once(): time.sleep(get_settings().job_poll_interval)