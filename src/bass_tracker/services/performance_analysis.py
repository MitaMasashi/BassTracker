import json
from dataclasses import dataclass

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from bass_tracker.db.models import AnalysisContext, AnalysisResult, AudioAsset, LatencyCalibration, NoteEvent, PracticeTrack, ProcessingJob, RecordingSession
from bass_tracker.errors import AppError
from bass_tracker.services.musical_analysis import load_audio
from bass_tracker.services.storage import FileStorage


@dataclass(frozen=True)
class Match:
    reference_time: float | None
    user_time: float | None
    timing_error_ms: float | None
    status: str


def count_in_duration(bpm: float, speed: float, bars: int, beats_per_bar: int) -> float:
    return bars * beats_per_bar * 60.0 / (bpm * speed)


def reference_recording_time(original: float, section_start: float, speed: float, count_in: float) -> float:
    return count_in + (original - section_start) / speed


def match_events(reference: list[float], user: list[float], latency_ms: float, tolerance_ms: float) -> list[Match]:
    corrected = [value - latency_ms / 1000 for value in user]; unused = set(range(len(corrected))); matches: list[Match] = []
    for ref in reference:
        candidates = [(abs(corrected[index] - ref), index) for index in unused if abs(corrected[index] - ref) * 1000 <= tolerance_ms]
        if not candidates: matches.append(Match(ref, None, None, "missing")); continue
        _, index = min(candidates); unused.remove(index); matches.append(Match(ref, user[index], (corrected[index] - ref) * 1000, "matched"))
    matches.extend(Match(None, user[index], None, "extra") for index in sorted(unused)); return matches


def event_level(y: np.ndarray, sr: int, onset: float, window_ms: float) -> float:
    start, end = int(onset * sr), int((onset + window_ms / 1000) * sr); rms = float(np.sqrt(np.mean(np.square(y[start:end])))) if end > start else 0
    return float(20 * np.log10(max(rms, 1e-10)))


class AnalysisService:
    def __init__(self, session: Session): self.session = session
    def start(self, recording_id: int):
        recording = self.session.get(RecordingSession, recording_id)
        if not recording: raise AppError("RECORDING_SESSION_NOT_FOUND", "RecordingSession was not found.", 404)
        reference = self.session.scalar(select(AudioAsset).where(AudioAsset.practice_track_id == recording.practice_track_id, AudioAsset.asset_type == "stem_bass").order_by(AudioAsset.created_at.desc()))
        if not reference: raise AppError("REFERENCE_ASSET_NOT_FOUND", "Reference bass asset was not found.", 409)
        calibration = self.session.get(LatencyCalibration, recording.latency_calibration_id) if recording.latency_calibration_id else None
        job = ProcessingJob(practice_track_id=recording.practice_track_id, job_type="performance_analysis", status="queued", parameters_json="{}"); self.session.add(job); self.session.flush()
        context = AnalysisContext(recording_session_id=recording.id, reference_audio_asset_id=reference.id, reference_start_seconds=recording.section_start_seconds, reference_end_seconds=recording.section_end_seconds, playback_speed=recording.playback_speed, latency_offset_ms=calibration.roundtrip_latency_ms if calibration else 0, onset_detector="librosa_onset", onset_detector_version="0.11", analysis_version="1", parameters_json=json.dumps({"matching_tolerance_ms": 80, "level_window_ms": 120, "onset_hop_length": 128}), processing_job_id=job.id)
        self.session.add(context); self.session.flush(); job.parameters_json = json.dumps({"analysis_context_id": context.id}); self.session.commit(); return context, job
    def histories(self, recording_id: int):
        contexts = list(self.session.scalars(select(AnalysisContext).where(AnalysisContext.recording_session_id == recording_id).order_by(AnalysisContext.created_at.desc())))
        results = {result.analysis_context_id: result for result in self.session.scalars(select(AnalysisResult).where(AnalysisResult.analysis_context_id.in_([context.id for context in contexts])))} if contexts else {}
        jobs = {job.id: job for job in self.session.scalars(select(ProcessingJob).where(ProcessingJob.id.in_([context.processing_job_id for context in contexts])))} if contexts else {}
        return [{
            "id": context.id,
            "recording_session_id": context.recording_session_id,
            "reference_audio_asset_id": context.reference_audio_asset_id,
            "reference_start_seconds": context.reference_start_seconds,
            "reference_end_seconds": context.reference_end_seconds,
            "playback_speed": context.playback_speed,
            "latency_offset_ms": context.latency_offset_ms,
            "onset_detector": context.onset_detector,
            "analysis_version": context.analysis_version,
            "processing_job_id": context.processing_job_id,
            "job_status": jobs[context.processing_job_id].status if context.processing_job_id in jobs else None,
            "analysis_result_id": results[context.id].id if context.id in results else None,
            "created_at": context.created_at,
        } for context in contexts]
    def result(self, result_id: int):
        result = self.session.get(AnalysisResult, result_id)
        if not result: raise AppError("ANALYSIS_RESULT_NOT_FOUND", "AnalysisResult was not found.", 404)
        return result


class PerformanceAnalysisProcessor:
    job_type = "performance_analysis"
    def __init__(self, session: Session, storage: FileStorage): self.session, self.storage = session, storage
    def run(self, job_id: int) -> None:
        import librosa
        job = self.session.get(ProcessingJob, job_id); context = self.session.get(AnalysisContext, json.loads(job.parameters_json)["analysis_context_id"]); recording = self.session.get(RecordingSession, context.recording_session_id); track = self.session.get(PracticeTrack, recording.practice_track_id); recording_asset = self.session.get(AudioAsset, recording.recording_audio_asset_id); reference_asset = self.session.get(AudioAsset, context.reference_audio_asset_id)
        ref_y, ref_sr = load_audio(self.storage.resolve(reference_asset.file_path)); user_y, user_sr = load_audio(self.storage.resolve(recording_asset.file_path)); parameters = json.loads(context.parameters_json)
        hop = int(parameters.get("onset_hop_length", 128))
        # ReferenceもSection区間だけを検出対象にし、User側と同条件のDetectorへ通す (仕様13.9)
        ref_slice = ref_y[int(max(0.0, context.reference_start_seconds) * ref_sr):int(max(0.0, context.reference_end_seconds) * ref_sr)]
        ref_samples = librosa.onset.onset_detect(y=ref_slice, sr=ref_sr, units="samples", hop_length=hop, backtrack=True); user_samples = librosa.onset.onset_detect(y=user_y, sr=user_sr, units="samples", hop_length=hop, backtrack=True)
        bpm, beats = track.bpm or 120, track.time_signature_numerator or 4; count_in = count_in_duration(bpm, recording.playback_speed, recording.count_in_bars, beats)
        reference = [reference_recording_time(context.reference_start_seconds + float(sample / ref_sr), context.reference_start_seconds, context.playback_speed, count_in) for sample in ref_samples]
        user = [float(sample / user_sr) for sample in user_samples]; matches = match_events(reference, user, context.latency_offset_ms, parameters["matching_tolerance_ms"]); errors = [match.timing_error_ms for match in matches if match.timing_error_ms is not None]; levels = [event_level(user_y, user_sr, match.user_time, parameters["level_window_ms"]) for match in matches if match.user_time is not None and match.status != "missing"]
        result = AnalysisResult(analysis_context_id=context.id, reference_note_count=len(reference), matched_note_count=sum(m.status == "matched" for m in matches), missing_note_count=sum(m.status == "missing" for m in matches), extra_note_count=sum(m.status == "extra" for m in matches), timing_mean_ms=float(np.mean(errors)) if errors else None, timing_mae_ms=float(np.mean(np.abs(errors))) if errors else None, timing_std_ms=float(np.std(errors)) if errors else None, level_mean_db=float(np.mean(levels)) if levels else None, level_std_db=float(np.std(levels)) if levels else None, level_min_db=float(np.min(levels)) if levels else None, level_max_db=float(np.max(levels)) if levels else None, analysis_status="succeeded"); self.session.add(result); self.session.flush()
        level_index = 0
        for index, match in enumerate(matches):
            level = levels[level_index] if match.user_time is not None else None; level_index += int(match.user_time is not None)
            self.session.add(NoteEvent(analysis_result_id=result.id, event_index=index, reference_time_seconds=match.reference_time, user_time_seconds=match.user_time, timing_error_ms=match.timing_error_ms, level_db=level, status=match.status))


class HistoryService:
    SECTION_TOLERANCE_SECONDS = 0.05  # 浮動小数の完全一致に依存しない (仕様14.6)
    def __init__(self, session: Session): self.session = session
    def list(self, track_id: int | None, limit: int, offset: int, section_start: float | None = None, section_end: float | None = None, from_time=None, to_time=None):
        query = select(RecordingSession).order_by(RecordingSession.recorded_at.desc()).limit(limit).offset(offset)
        if track_id: query = query.where(RecordingSession.practice_track_id == track_id)
        if section_start is not None: query = query.where(RecordingSession.section_start_seconds.between(section_start - self.SECTION_TOLERANCE_SECONDS, section_start + self.SECTION_TOLERANCE_SECONDS))
        if section_end is not None: query = query.where(RecordingSession.section_end_seconds.between(section_end - self.SECTION_TOLERANCE_SECONDS, section_end + self.SECTION_TOLERANCE_SECONDS))
        if from_time: query = query.where(RecordingSession.recorded_at >= from_time)
        if to_time: query = query.where(RecordingSession.recorded_at <= to_time)
        items = []
        for recording in self.session.scalars(query):
            track = self.session.get(PracticeTrack, recording.practice_track_id); context = self.session.scalar(select(AnalysisContext).where(AnalysisContext.recording_session_id == recording.id).order_by(AnalysisContext.created_at.desc())); result = self.session.scalar(select(AnalysisResult).where(AnalysisResult.analysis_context_id == context.id)) if context else None
            items.append({"recording_session_id": recording.id, "recorded_at": recording.recorded_at, "practice_track_id": track.id, "practice_track": track.display_title, "section_start_seconds": recording.section_start_seconds, "section_end_seconds": recording.section_end_seconds, "playback_speed": recording.playback_speed, "result_id": result.id if result else None, "timing_mean_ms": result.timing_mean_ms if result else None, "timing_mae_ms": result.timing_mae_ms if result else None, "timing_std_ms": result.timing_std_ms if result else None, "level_std_db": result.level_std_db if result else None, "missing_note_count": result.missing_note_count if result else None, "extra_note_count": result.extra_note_count if result else None})
        return items