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
    job_history = session.execute(
        select(ProcessingJob.job_type, ProcessingJob.status)
        .where(
            ProcessingJob.practice_track_id == track_id,
            ProcessingJob.job_type.in_(TRACK_JOB_TYPES),
        )
        .order_by(ProcessingJob.created_at, ProcessingJob.id)
    ).all()
    # Retry creates a new job and deliberately leaves the failed source job in
    # history.  Availability must therefore follow the newest attempt of each
    # job type, not every historical failure.
    latest_status = {job_type: status for job_type, status in job_history}
    pending = any(status in ("queued", "running") for status in latest_status.values())
    failed = any(status == "failed" for status in latest_status.values())
    succeeded = {job_type for job_type, status in latest_status.items() if status == "succeeded"}
    if "source_audio" not in assets:
        if latest_status.get("import") == "failed": track.status = "error"
        else: track.status = "processing" if pending else "registered"
    elif pending: track.status = "processing"
    elif not failed and all(asset in assets for asset in READY_ASSET_TYPES) and track.bpm and track.musical_key and all(job_type in succeeded for job_type in READY_JOB_TYPES): track.status = "ready"
    else: track.status = "partial"
    session.commit()
    return track.status
