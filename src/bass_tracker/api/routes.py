from typing import Annotated

import json

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from bass_tracker.db.session import get_session
from bass_tracker.config import get_settings
from bass_tracker.errors import AppError
from bass_tracker.schemas import AnalysisAccepted, AnalysisContextResponse, AnalysisResultResponse, AudioAssetResponse, CalibrationCreate, CalibrationResponse, ChordEventResponse, ChordPatch, HistoryItem, ImportAccepted, JobResponse, MusicalAnalysisResponse, NoteEventResponse, PitchEventResponse, PitchPatch, RecordingMetadata, RecordingSessionResponse, TrackListResponse, TrackPatch, TrackResponse, YouTubeImportRequest, YouTubeMetadataRequest
from bass_tracker.services.core import JobService, TrackService
from bass_tracker.services.imports import ImportApplicationService, default_import_dependencies, list_assets
from bass_tracker.services.musical_analysis import MusicalAnalysisService
from bass_tracker.services.performance_analysis import AnalysisService, HistoryService
from bass_tracker.services.recording import RecordingService

router = APIRouter()


DbSession = Annotated[Session, Depends(get_session)]


@router.get("/health", tags=["system"])
def health() -> dict[str, str]: return {"status": "ok"}


@router.get("/practice-tracks", response_model=TrackListResponse, tags=["practice tracks"])
def list_practice_tracks(session: DbSession, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)) -> TrackListResponse:
    items, total = TrackService(session).list(limit, offset); return TrackListResponse(items=items, total=total)


@router.get("/practice-tracks/{track_id}", response_model=TrackResponse, tags=["practice tracks"])
def get_practice_track(track_id: int, session: DbSession): return TrackService(session).get(track_id)


@router.patch("/practice-tracks/{track_id}", response_model=TrackResponse, tags=["practice tracks"])
def patch_practice_track(track_id: int, patch: TrackPatch, session: DbSession): return TrackService(session).update(track_id, patch)


@router.get("/practice-tracks/{track_id}/jobs", response_model=list[JobResponse], tags=["jobs"])
def list_jobs(track_id: int, session: DbSession): return JobService(session).list_for_track(track_id)


@router.get("/jobs/{job_id}", response_model=JobResponse, tags=["jobs"])
def get_job(job_id: int, session: DbSession): return JobService(session).get(job_id)


@router.post("/jobs/{job_id}/retry", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED, tags=["jobs"])
def retry_job(job_id: int, session: DbSession): return JobService(session).retry(job_id)


@router.post("/import/local", response_model=ImportAccepted, status_code=status.HTTP_202_ACCEPTED, tags=["import"])
async def import_local(session: DbSession, file: UploadFile = File(...), display_title: str = Form(...), song_title: str | None = Form(None), artist_name: str | None = Form(None)):
    storage, _ = default_import_dependencies(session)
    track_id, job_id = await ImportApplicationService(session, storage).register_local(file, display_title, song_title, artist_name)
    return ImportAccepted(practice_track_id=track_id, processing_job_id=job_id)


@router.post("/import/youtube/metadata", tags=["import"])
def youtube_metadata(request: YouTubeMetadataRequest, session: DbSession):
    _, commands = default_import_dependencies(session)
    try: metadata = commands.youtube_metadata(str(request.url))
    except Exception as exc: raise AppError("YOUTUBE_METADATA_FAILED", str(exc), 400) from exc
    return {"source_url": request.url, "external_id": metadata.get("id"), "source_title": metadata.get("title"), "source_creator": metadata.get("uploader"), "source_creator_id": metadata.get("channel_id"), "thumbnail_url": metadata.get("thumbnail"), "duration_seconds": metadata.get("duration")}


@router.post("/import/youtube", response_model=ImportAccepted, status_code=status.HTTP_202_ACCEPTED, tags=["import"])
def import_youtube(request: YouTubeImportRequest, session: DbSession):
    storage, commands = default_import_dependencies(session)
    try: metadata = commands.youtube_metadata(str(request.url))
    except Exception as exc: raise AppError("YOUTUBE_METADATA_FAILED", str(exc), 400) from exc
    track_id, job_id = ImportApplicationService(session, storage).register_youtube(str(request.url), request.display_title, request.song_title, request.artist_name, metadata)
    return ImportAccepted(practice_track_id=track_id, processing_job_id=job_id)


@router.get("/practice-tracks/{track_id}/audio-assets", response_model=list[AudioAssetResponse], tags=["audio assets"])
def get_audio_assets(track_id: int, session: DbSession):
    TrackService(session).get(track_id); return list_assets(session, track_id)


@router.get("/audio-assets/{asset_id}", response_model=AudioAssetResponse, tags=["audio assets"])
def get_audio_asset(asset_id: int, session: DbSession):
    from bass_tracker.db.models import AudioAsset
    asset = session.get(AudioAsset, asset_id)
    if not asset: raise AppError("AUDIO_ASSET_NOT_FOUND", "AudioAsset was not found.", 404)
    return asset


@router.get("/audio-assets/{asset_id}/content", tags=["audio assets"])
def get_audio_content(asset_id: int, session: DbSession):
    from bass_tracker.db.models import AudioAsset
    asset = session.get(AudioAsset, asset_id)
    if not asset: raise AppError("AUDIO_ASSET_NOT_FOUND", "AudioAsset was not found.", 404)
    storage, _ = default_import_dependencies(session)
    try: path = storage.resolve(asset.file_path)
    except ValueError as exc: raise AppError("INVALID_ASSET_PATH", str(exc), 500) from exc
    if not path.is_file(): raise AppError("AUDIO_CONTENT_NOT_FOUND", "Audio content was not found.", 404)
    return FileResponse(path, media_type="audio/wav", filename=path.name)


@router.get("/practice-tracks/{track_id}/musical-analysis", response_model=MusicalAnalysisResponse, tags=["musical analysis"])
def musical_analysis(track_id: int, session: DbSession): return MusicalAnalysisService(session).summary(track_id)


@router.get("/practice-tracks/{track_id}/chords", response_model=list[ChordEventResponse], tags=["musical analysis"])
def chords(track_id: int, session: DbSession, start_seconds: float | None = None, end_seconds: float | None = None): return MusicalAnalysisService(session).chords(track_id, start_seconds, end_seconds)


@router.patch("/chord-events/{event_id}", response_model=ChordEventResponse, tags=["musical analysis"])
def patch_chord(event_id: int, patch: ChordPatch, session: DbSession): return MusicalAnalysisService(session).update_chord(event_id, patch.model_dump(exclude_unset=True))


@router.get("/practice-tracks/{track_id}/pitch-events", response_model=list[PitchEventResponse], tags=["musical analysis"])
def pitches(track_id: int, session: DbSession, start_seconds: float | None = None, end_seconds: float | None = None): return MusicalAnalysisService(session).pitches(track_id, start_seconds, end_seconds)


@router.patch("/pitch-events/{event_id}", tags=["musical analysis"])
def patch_pitch(event_id: int, patch: PitchPatch, session: DbSession): return MusicalAnalysisService(session).update_pitch(event_id, patch.selected_pitch, patch.selected_midi_note)


@router.post("/latency-calibrations", response_model=CalibrationResponse, status_code=201, tags=["recording"])
def create_calibration(request: CalibrationCreate, session: DbSession): return RecordingService(session, default_import_dependencies(session)[0]).create_calibration(request)


@router.get("/latency-calibrations", response_model=list[CalibrationResponse], tags=["recording"])
def calibrations(session: DbSession, input_device_id: str | None = None, output_device_id: str | None = None, sample_rate_hz: int | None = None): return RecordingService(session, default_import_dependencies(session)[0]).calibrations(input_device_id, output_device_id, sample_rate_hz)


@router.post("/recording-sessions", response_model=RecordingSessionResponse, status_code=201, tags=["recording"])
async def create_recording(session: DbSession, file: UploadFile = File(...), metadata_json: str = Form(...)):
    try: metadata = RecordingMetadata.model_validate(json.loads(metadata_json))
    except (json.JSONDecodeError, ValueError) as exc: raise AppError("INVALID_RECORDING_METADATA", "metadata_json is invalid.", 422) from exc
    return await RecordingService(session, default_import_dependencies(session)[0]).save_recording(file, metadata)


@router.get("/recording-sessions", response_model=list[RecordingSessionResponse], tags=["recording"])
def recording_sessions(session: DbSession, practice_track_id: int | None = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)): return RecordingService(session, default_import_dependencies(session)[0]).list_sessions(practice_track_id, limit, offset)


@router.get("/recording-sessions/{session_id}", response_model=RecordingSessionResponse, tags=["recording"])
def recording_session(session_id: int, session: DbSession): return RecordingService(session, default_import_dependencies(session)[0]).get_session(session_id)


@router.post("/recording-sessions/{session_id}/analyses", response_model=AnalysisAccepted, status_code=202, tags=["analysis"])
def start_analysis(session_id: int, session: DbSession):
    context, job = AnalysisService(session).start(session_id); return AnalysisAccepted(analysis_context_id=context.id, processing_job_id=job.id)


@router.get("/recording-sessions/{session_id}/analyses", response_model=list[AnalysisContextResponse], tags=["analysis"])
def analyses(session_id: int, session: DbSession): return AnalysisService(session).histories(session_id)


@router.get("/analysis-results/{result_id}", response_model=AnalysisResultResponse, tags=["analysis"])
def analysis_result(result_id: int, session: DbSession): return AnalysisService(session).result(result_id)


@router.get("/analysis-results/{result_id}/note-events", response_model=list[NoteEventResponse], tags=["analysis"])
def note_events(result_id: int, session: DbSession):
    from bass_tracker.db.models import NoteEvent
    AnalysisService(session).result(result_id); return list(session.scalars(select(NoteEvent).where(NoteEvent.analysis_result_id == result_id).order_by(NoteEvent.event_index)))


@router.get("/history", response_model=list[HistoryItem], tags=["history"])
def history(session: DbSession, practice_track_id: int | None = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)): return HistoryService(session).list(practice_track_id, limit, offset)
