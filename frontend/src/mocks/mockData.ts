import type {
  AnalysisResult,
  ChordEvent,
  LatencyCalibration,
  PitchEvent,
  PracticeTrackSummary,
  ProcessingJob,
  RecordingSession,
} from "../api/types";

export const tracks: PracticeTrackSummary[] = [
  { id: 12, displayTitle: "Sample Song Official Video", songTitle: "Sample Song", artistName: "Artist A", durationSeconds: 222.5, bpm: 118, musicalKey: "E minor", status: "ready", sourceType: "youtube" },
  { id: 18, displayTitle: "Practice Track 01", songTitle: "Midnight Lines", artistName: "Studio Notes", durationSeconds: 196, bpm: 132, musicalKey: "A minor", status: "partial", sourceType: "local_file" },
  { id: 23, displayTitle: "Live Session 2026", songTitle: null, artistName: null, durationSeconds: null, bpm: null, musicalKey: null, status: "processing", sourceType: "youtube" },
];

export const jobs: ProcessingJob[] = [
  { id: 100, practiceTrackId: 12, jobType: "Import", status: "succeeded", errorMessage: null },
  { id: 101, practiceTrackId: 12, jobType: "Stem separation", status: "succeeded", errorMessage: null },
  { id: 102, practiceTrackId: 12, jobType: "Chord analysis", status: "running", errorMessage: null },
  { id: 103, practiceTrackId: 12, jobType: "Pitch hint", status: "failed", errorMessage: "Processor timed out" },
];

export const chordEvents: ChordEvent[] = ["Em", "C", "G", "D", "Em", "C", "Am", "B7"].map((selectedChord, index) => ({ id: index + 1, startSeconds: 80 + index * 2, endSeconds: 82 + index * 2, selectedChord }));

export const pitchEvents: PitchEvent[] = [
  { id: 1, onsetSeconds: 84.382, selectedPitch: "E2", candidates: [{ rank: 1, pitch: "E2", midiNote: 40, score: 0.78 }, { rank: 2, pitch: "E3", midiNote: 52, score: 0.14 }, { rank: 3, pitch: "B1", midiNote: 35, score: 0.05 }] },
  { id: 2, onsetSeconds: 86.1, selectedPitch: "G2", candidates: [{ rank: 1, pitch: "G2", midiNote: 43, score: 0.84 }] },
];

export const recordings: RecordingSession[] = [
  { id: 201, trackId: 12, recordedAt: "2026-08-28T09:42:00Z", sectionStartSeconds: 80, sectionEndSeconds: 92, playbackSpeed: 1, sampleRateHz: 48000 },
  { id: 202, trackId: 12, recordedAt: "2026-08-28T09:31:00Z", sectionStartSeconds: 80, sectionEndSeconds: 92, playbackSpeed: 0.9, sampleRateHz: 48000 },
  { id: 203, trackId: 12, recordedAt: "2026-08-27T22:14:00Z", sectionStartSeconds: 40, sectionEndSeconds: 52, playbackSpeed: 0.75, sampleRateHz: 48000 },
];

export const analysisResult: AnalysisResult = {
  timingMeanMs: 12, timingMaeMs: 24, timingStdMs: 17, levelStdDb: 2.1, matchedNoteCount: 121, missingNoteCount: 7, extraNoteCount: 4,
  noteEvents: [
    { eventIndex: 31, referenceTimeSeconds: 84, userTimeSeconds: 84.018, timingErrorMs: 18, levelDb: -14.2, status: "matched" },
    { eventIndex: 32, referenceTimeSeconds: 84.5, userTimeSeconds: 84.491, timingErrorMs: -9, levelDb: -13.8, status: "matched" },
    { eventIndex: 33, referenceTimeSeconds: 85, userTimeSeconds: 85.032, timingErrorMs: 32, levelDb: -18.1, status: "matched" },
    { eventIndex: 34, referenceTimeSeconds: 85.5, userTimeSeconds: null, timingErrorMs: null, levelDb: null, status: "missing" },
  ],
};

export const calibration: LatencyCalibration = { id: 4, inputDeviceId: "focusrite-input-1", outputDeviceId: "focusrite-output", sampleRateHz: 48000, roundtripLatencyMs: 26.8, calibrationMethod: "cable_loopback" };