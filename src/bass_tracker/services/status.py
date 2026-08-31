from sqlalchemy import select
from sqlalchemy.orm import Session

from bass_tracker.db.models import AudioAsset, PracticeTrack, ProcessingJob

TRACK_JOB_TYPES = ("import", "stem_separation", "bpm_analysis", "key_analysis", "chord_analysis", "pitch_analysis")
READY_ASSET_TYPES = ("source_audio", "stem_bass", "bass_mute")
READY_JOB_TYPES = ("bpm_analysis", "key_analysis", "chord_analysis")


def refresh_track_status(session: Session, track_id: int) -> str | None:
    """Recompute practice_tracks.status from assets and job history."""
    track = session.get(PracticeTrack, track_id)
    if not track: return None
    assets = set(session.scalars(select(AudioAsset.asset_type).where(AudioAsset.practice_track_id == track_id)))
    jobs = [(job_type, status) for job_type, status in session.execute(select(ProcessingJob.job_type, ProcessingJob.status).where(ProcessingJob.practice_track_id == track_id)).all() if job_type in TRACK_JOB_TYPES]
    pending = any(status in ("queued", "running") for _, status in jobs)
    failed = any(status == "failed" for _, status in jobs)
    succeeded = {job_type for job_type, status in jobs if status == "succeeded"}
    if "source_audio" not in assets:
        if any(job_type == "import" and status == "failed" for job_type, status in jobs): track.status = "error"
        else: track.status = "processing" if pending else "registered"
    elif pending: track.status = "processing"
    elif not failed and all(asset in assets for asset in READY_ASSET_TYPES) and track.bpm and track.musical_key and all(job_type in succeeded for job_type in READY_JOB_TYPES): track.status = "ready"
    else: track.status = "partial"
    session.commit()
    return track.status
