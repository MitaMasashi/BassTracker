export type ViewState = "normal" | "loading" | "empty" | "error";
export type PracticeTrackStatus = "registered" | "processing" | "ready" | "partial" | "error";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface PracticeTrackSummary {
  id: number;
  displayTitle: string;
  songTitle: string | null;
  artistName: string | null;
  durationSeconds: number | null;
  bpm: number | null;
  musicalKey: string | null;
  status: PracticeTrackStatus;
  sourceType: "local_file" | "youtube";
}

export interface ProcessingJob {
  id: number;
  practiceTrackId: number;
  jobType: string;
  status: JobStatus;
  errorMessage: string | null;
}

export interface PitchCandidate { rank: number; pitch: string; midiNote: number; score: number }
export interface PitchEvent { id: number; onsetSeconds: number; selectedPitch: string; candidates: PitchCandidate[] }
export interface ChordEvent { id: number; startSeconds: number; endSeconds: number; selectedChord: string }

export interface RecordingSession {
  id: number;
  trackId: number;
  recordedAt: string;
  sectionStartSeconds: number;
  sectionEndSeconds: number;
  playbackSpeed: number;
  sampleRateHz: number;
}

export interface NoteEvent {
  eventIndex: number;
  referenceTimeSeconds: number | null;
  userTimeSeconds: number | null;
  timingErrorMs: number | null;
  levelDb: number | null;
  status: "matched" | "missing" | "extra";
}

export interface AnalysisResult {
  timingMeanMs: number;
  timingMaeMs: number;
  timingStdMs: number;
  levelStdDb: number;
  matchedNoteCount: number;
  missingNoteCount: number;
  extraNoteCount: number;
  noteEvents: NoteEvent[];
}

export interface LatencyCalibration {
  id: number;
  inputDeviceId: string;
  outputDeviceId: string;
  sampleRateHz: number;
  roundtripLatencyMs: number;
  calibrationMethod: string;
}