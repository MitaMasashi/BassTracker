const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error?.code ?? "REQUEST_FAILED", body?.error?.message ?? response.statusText, response.status);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export interface ApiTrack { id: number; display_title: string; song_title: string | null; artist_name: string | null; duration_seconds: number | null; bpm: number | null; musical_key: string | null; status: string }
export interface ApiJob { id: number; practice_track_id: number; job_type: string; status: string; error_message: string | null }
export interface ApiAsset { id: number; practice_track_id: number; asset_type: string; file_path: string; format: string; sample_rate_hz: number | null; channels: number | null; duration_seconds: number | null }
export interface ApiRecording { id: number; practice_track_id: number; recording_audio_asset_id: number; section_start_seconds: number; section_end_seconds: number; playback_speed: number; count_in_bars: number; sample_rate_hz: number; audio_input_device_id: string | null; audio_output_device_id: string | null; latency_calibration_id: number | null; recorded_at: string }
export interface ApiHistory { recording_session_id: number; recorded_at: string; practice_track_id: number; practice_track: string; section_start_seconds: number; section_end_seconds: number; playback_speed: number; result_id: number | null; timing_mean_ms: number | null; timing_mae_ms: number | null; timing_std_ms: number | null; level_std_db: number | null; missing_note_count: number | null; extra_note_count: number | null }
export interface ApiChord { id: number; start_seconds: number; end_seconds: number; detected_chord: string; selected_chord: string; confidence: number | null; is_user_corrected: boolean }
export interface ApiPitchCandidate { rank: number; pitch: string; midi_note: number; frequency_hz: number; score: number }
export interface ApiPitch { id: number; onset_seconds: number; end_seconds: number | null; selected_pitch: string | null; selected_midi_note: number | null; is_user_corrected: boolean; candidates: ApiPitchCandidate[] }
export interface ApiCalibration { id: number; input_device_id: string; output_device_id: string; sample_rate_hz: number; browser_info: string | null; roundtrip_latency_ms: number; calibration_method: string; measured_at: string }
export interface ApiAnalysisContext { id: number; recording_session_id: number; reference_audio_asset_id: number; reference_start_seconds: number; reference_end_seconds: number; playback_speed: number; latency_offset_ms: number; onset_detector: string; analysis_version: string; processing_job_id: number; job_status: string | null; analysis_result_id: number | null; created_at: string }
export interface ApiAnalysisResult { id: number; analysis_context_id: number; reference_note_count: number; matched_note_count: number; missing_note_count: number; extra_note_count: number; timing_mean_ms: number | null; timing_mae_ms: number | null; timing_std_ms: number | null; level_mean_db: number | null; level_std_db: number | null; level_min_db: number | null; level_max_db: number | null; analysis_status: string; analyzed_at: string }
export interface ApiNoteEvent { id: number; event_index: number; reference_time_seconds: number | null; user_time_seconds: number | null; timing_error_ms: number | null; level_db: number | null; status: "matched" | "missing" | "extra" }

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  return search.toString() ? `?${search}` : "";
}

const jsonInit = (method: string, body: object): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  tracks: () => request<{ items: ApiTrack[]; total: number }>("/practice-tracks"),
  jobs: (trackId: number) => request<ApiJob[]>(`/practice-tracks/${trackId}/jobs`),
  job: (jobId: number) => request<ApiJob>(`/jobs/${jobId}`),
  retryJob: (jobId: number) => request<ApiJob>(`/jobs/${jobId}/retry`, { method: "POST" }),
  importLocal: (form: FormData) => request<{ practice_track_id: number; processing_job_id: number }>("/import/local", { method: "POST", body: form }),
  youtubeMetadata: (url: string) => request<Record<string, string | number | null>>("/import/youtube/metadata", jsonInit("POST", { url })),
  importYoutube: (body: object) => request<{ practice_track_id: number; processing_job_id: number }>("/import/youtube", jsonInit("POST", body)),
  musicalAnalysis: (trackId: number) => request<{ bpm: number | null; musical_key: string | null; time_signature: { numerator: number | null; denominator: number | null }; assets: Record<string, number> }>(`/practice-tracks/${trackId}/musical-analysis`),
  assets: (trackId: number) => request<ApiAsset[]>(`/practice-tracks/${trackId}/audio-assets`),
  chords: (trackId: number) => request<ApiChord[]>(`/practice-tracks/${trackId}/chords`),
  patchChord: (eventId: number, body: { selected_chord?: string; start_seconds?: number; end_seconds?: number }) => request<ApiChord>(`/chord-events/${eventId}`, jsonInit("PATCH", body)),
  pitches: (trackId: number) => request<ApiPitch[]>(`/practice-tracks/${trackId}/pitch-events`),
  patchPitch: (eventId: number, body: { selected_pitch: string; selected_midi_note: number }) => request<unknown>(`/pitch-events/${eventId}`, jsonInit("PATCH", body)),
  assetContent: (assetId: number) => `${API_BASE}/audio-assets/${assetId}/content`,
  calibrations: (filters: { input_device_id?: string; sample_rate_hz?: number } = {}) => request<ApiCalibration[]>(`/latency-calibrations${query(filters)}`),
  createCalibration: (body: object) => request<ApiCalibration>("/latency-calibrations", jsonInit("POST", body)),
  recordings: (trackId?: number) => request<ApiRecording[]>(`/recording-sessions${query({ practice_track_id: trackId })}`),
  uploadRecording: (form: FormData) => request<ApiRecording>("/recording-sessions", { method: "POST", body: form }),
  startAnalysis: (sessionId: number) => request<{ analysis_context_id: number; processing_job_id: number }>(`/recording-sessions/${sessionId}/analyses`, { method: "POST" }),
  analyses: (sessionId: number) => request<ApiAnalysisContext[]>(`/recording-sessions/${sessionId}/analyses`),
  analysisResult: (resultId: number) => request<ApiAnalysisResult>(`/analysis-results/${resultId}`),
  noteEvents: (resultId: number) => request<ApiNoteEvent[]>(`/analysis-results/${resultId}/note-events`),
  history: (trackId?: number) => request<ApiHistory[]>(`/history${query({ practice_track_id: trackId })}`),
};