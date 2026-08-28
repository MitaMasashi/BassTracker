from typing import Protocol


class ImportService(Protocol):
    """Creates MediaSource and source_audio from an input source."""


class AudioProcessingService(Protocol):
    """Handles normalization, stem separation, and musical analysis jobs."""


class RecordingService(Protocol):
    """Coordinates client recording upload and RecordingSession persistence."""


class PerformanceAnalysisService(Protocol):
    """Creates AnalysisContext and evaluates a recorded performance."""
