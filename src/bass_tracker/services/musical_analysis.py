import json
import shutil
from pathlib import Path

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from bass_tracker.config import get_settings
from bass_tracker.db.models import AudioAsset, ChordEvent, PitchCandidate, PitchEvent, PracticeTrack, ProcessingJob, ProcessingJobInput, ProcessingJobOutput
from bass_tracker.errors import AppError
from bass_tracker.services.commands import AudioCommands
from bass_tracker.services.storage import FileStorage


NOTES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")


def midi_name(midi_note: int) -> str:
    return f"{NOTES[midi_note % 12]}{midi_note // 12 - 1}"


def load_audio(path: Path):
    import librosa
    return librosa.load(path, sr=48000, mono=True)


def get_asset(session: Session, asset_id: int) -> AudioAsset:
    asset = session.get(AudioAsset, asset_id)
    if not asset: raise RuntimeError("Input AudioAsset was not found.")
    return asset


class StemSeparationProcessor:
    job_type = "stem_separation"
    def __init__(self, session: Session, storage: FileStorage, commands: AudioCommands): self.session, self.storage, self.commands = session, storage, commands
    def run(self, job_id: int) -> None:
        job = self.session.get(ProcessingJob, job_id); params = json.loads(job.parameters_json or "{}")
        source = get_asset(self.session, params["source_asset_id"]); source_path = self.storage.resolve(source.file_path)
        stems = self.commands.separate(source_path, self.storage.temp_root / f"demucs_{job.id}", get_settings().demucs_model or "htdemucs")
        outputs: dict[str, AudioAsset] = {}
        target_dir = self.storage.data_root / "tracks" / str(job.practice_track_id) / "assets"; target_dir.mkdir(parents=True, exist_ok=True)
        for stem_name, source_stem in stems.items():
            destination = target_dir / f"stem_{stem_name}.wav"; shutil.copy2(source_stem, destination)
            info = self.commands.probe(destination)
            asset = AudioAsset(practice_track_id=job.practice_track_id, origin_media_source_id=source.origin_media_source_id, parent_asset_id=source.id, asset_type=f"stem_{stem_name}", file_path=self.storage.relative(destination), format="wav", sample_rate_hz=info.sample_rate_hz, channels=info.channels, duration_seconds=info.duration_seconds, processing_method="demucs", processing_version=get_settings().demucs_model or "htdemucs")
            self.session.add(asset); self.session.flush(); outputs[stem_name] = asset; self.session.add(ProcessingJobOutput(processing_job_id=job.id, audio_asset_id=asset.id, role=asset.asset_type))
        bass_mute_path = target_dir / "bass_mute.wav"; self.commands.mix([stems[name] for name in ("drums", "vocals", "other")], bass_mute_path); info = self.commands.probe(bass_mute_path)
        bass_mute = AudioAsset(practice_track_id=job.practice_track_id, origin_media_source_id=source.origin_media_source_id, parent_asset_id=source.id, asset_type="bass_mute", file_path=self.storage.relative(bass_mute_path), format="wav", sample_rate_hz=info.sample_rate_hz, channels=info.channels, duration_seconds=info.duration_seconds, processing_method="ffmpeg_amix", processing_version="normalize_1")
        self.session.add(bass_mute); self.session.flush(); self.session.add(ProcessingJobOutput(processing_job_id=job.id, audio_asset_id=bass_mute.id, role="bass_mute")); self.session.add(ProcessingJobInput(processing_job_id=job.id, audio_asset_id=source.id, role="source_audio"))
        self.session.add(ProcessingJob(practice_track_id=job.practice_track_id, job_type="pitch_analysis", status="queued", parameters_json=json.dumps({"source_asset_id": outputs["bass"].id, "candidate_count": 3, "fmin": 28.0, "fmax": 500.0})))


class LibrosaAnalysisProcessor:
    def __init__(self, session: Session, storage: FileStorage, job_type: str): self.session, self.storage, self.job_type = session, storage, job_type
    def run(self, job_id: int) -> None:
        import librosa
        job = self.session.get(ProcessingJob, job_id); params = json.loads(job.parameters_json or "{}"); asset = get_asset(self.session, params["source_asset_id"]); y, sr = load_audio(self.storage.resolve(asset.file_path)); track = self.session.get(PracticeTrack, job.practice_track_id)
        if self.job_type == "bpm_analysis":
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr); track.bpm = float(np.asarray(tempo).item()); job.result_json = json.dumps({"bpm": track.bpm})
        elif self.job_type == "key_analysis":
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1); index = int(np.argmax(chroma)); track.musical_key = f"{NOTES[index]} major"; job.result_json = json.dumps({"musical_key": track.musical_key, "score": float(chroma[index] / max(chroma.sum(), 1e-9))})
        elif self.job_type == "chord_analysis":
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr); duration = len(y) / sr
            for index, start in enumerate(np.arange(0, duration, 2.0)):
                frame_start = int(start / duration * chroma.shape[1]) if duration else 0; frame_end = max(frame_start + 1, int(min(start + 2, duration) / duration * chroma.shape[1])) if duration else 1; values = chroma[:, frame_start:frame_end].mean(axis=1); root = int(np.argmax(values)); score = float(values[root] / max(values.sum(), 1e-9)); chord = f"{NOTES[root]}"
                self.session.add(ChordEvent(practice_track_id=job.practice_track_id, processing_job_id=job.id, start_seconds=float(start), end_seconds=float(min(start + 2, duration)), detected_chord=chord, selected_chord=chord, confidence=score))
        elif self.job_type == "pitch_analysis":
            onsets = librosa.onset.onset_detect(y=y, sr=sr, units="samples"); fmin, fmax = params.get("fmin", 28.0), params.get("fmax", 500.0)
            for sample in onsets:
                segment = y[sample:min(len(y), sample + int(sr * .35))]; pitches, magnitudes = librosa.piptrack(y=segment, sr=sr, fmin=fmin, fmax=fmax); scores: dict[int, float] = {}
                for frequency, magnitude in zip(pitches.flat, magnitudes.flat):
                    if frequency > 0: scores[int(round(librosa.hz_to_midi(frequency)))] = max(scores.get(int(round(librosa.hz_to_midi(frequency))), 0), float(magnitude))
                ranked = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)[:params.get("candidate_count", 3)]
                if not ranked: continue
                event = PitchEvent(practice_track_id=job.practice_track_id, processing_job_id=job.id, onset_seconds=float(sample / sr), end_seconds=float(min(len(y), sample + len(segment)) / sr), selected_pitch=midi_name(ranked[0][0]), selected_midi_note=ranked[0][0]); self.session.add(event); self.session.flush(); maximum = max(score for _, score in ranked)
                for rank, (midi_note, score) in enumerate(ranked, 1): self.session.add(PitchCandidate(pitch_event_id=event.id, rank=rank, pitch=midi_name(midi_note), midi_note=midi_note, frequency_hz=float(librosa.midi_to_hz(midi_note)), score=float(score / maximum)))


class MusicalAnalysisService:
    def __init__(self, session: Session): self.session = session
    def summary(self, track_id: int) -> dict:
        track = self.session.get(PracticeTrack, track_id)
        if not track: raise AppError("TRACK_NOT_FOUND", "PracticeTrack was not found.", 404)
        assets = self.session.scalars(select(AudioAsset).where(AudioAsset.practice_track_id == track_id)).all()
        return {"bpm": track.bpm, "musical_key": track.musical_key, "time_signature": {"numerator": track.time_signature_numerator, "denominator": track.time_signature_denominator}, "assets": {asset.asset_type: asset.id for asset in assets}}
    def chords(self, track_id: int, start: float | None, end: float | None):
        query = select(ChordEvent).where(ChordEvent.practice_track_id == track_id)
        if start is not None: query = query.where(ChordEvent.end_seconds >= start)
        if end is not None: query = query.where(ChordEvent.start_seconds <= end)
        return list(self.session.scalars(query.order_by(ChordEvent.start_seconds)))
    def update_chord(self, event_id: int, values: dict):
        event = self.session.get(ChordEvent, event_id)
        if not event: raise AppError("CHORD_EVENT_NOT_FOUND", "ChordEvent was not found.", 404)
        for key, value in values.items(): setattr(event, key, value)
        if event.end_seconds <= event.start_seconds: raise AppError("INVALID_EVENT_RANGE", "end_seconds must be after start_seconds.", 422)
        event.is_user_corrected = True; self.session.commit(); self.session.refresh(event); return event
    def pitches(self, track_id: int, start: float | None, end: float | None):
        query = select(PitchEvent).where(PitchEvent.practice_track_id == track_id)
        if start is not None: query = query.where(PitchEvent.onset_seconds >= start)
        if end is not None: query = query.where(PitchEvent.onset_seconds <= end)
        events = list(self.session.scalars(query.order_by(PitchEvent.onset_seconds))); return [{"id": event.id, "onset_seconds": event.onset_seconds, "end_seconds": event.end_seconds, "selected_pitch": event.selected_pitch, "selected_midi_note": event.selected_midi_note, "is_user_corrected": event.is_user_corrected, "candidates": list(self.session.scalars(select(PitchCandidate).where(PitchCandidate.pitch_event_id == event.id).order_by(PitchCandidate.rank)))} for event in events]
    def update_pitch(self, event_id: int, pitch: str, midi_note: int):
        event = self.session.get(PitchEvent, event_id)
        if not event: raise AppError("PITCH_EVENT_NOT_FOUND", "PitchEvent was not found.", 404)
        event.selected_pitch, event.selected_midi_note, event.is_user_corrected = pitch, midi_note, True; self.session.commit(); self.session.refresh(event); return event