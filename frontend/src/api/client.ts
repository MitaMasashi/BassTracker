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

export const api = {
  tracks: () => request<{ items: ApiTrack[]; total: number }>("/practice-tracks"),
  jobs: (trackId: number) => request<ApiJob[]>(`/practice-tracks/${trackId}/jobs`),
  retryJob: (jobId: number) => request<ApiJob>(`/jobs/${jobId}/retry`, { method: "POST" }),
  importLocal: (form: FormData) => request<{ practice_track_id: number; processing_job_id: number }>("/import/local", { method: "POST", body: form }),
  youtubeMetadata: (url: string) => request<Record<string, string | number | null>>("/import/youtube/metadata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }),
  importYoutube: (body: object) => request<{ practice_track_id: number; processing_job_id: number }>("/import/youtube", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  musicalAnalysis: (trackId: number) => request<{ bpm: number | null; musical_key: string | null; time_signature: { numerator: number | null; denominator: number | null }; assets: Record<string, number> }>(`/practice-tracks/${trackId}/musical-analysis`),
  chords: (trackId: number) => request<Array<{ id: number; start_seconds: number; end_seconds: number; selected_chord: string }>>(`/practice-tracks/${trackId}/chords`),
  pitches: (trackId: number) => request<Array<{ id: number; onset_seconds: number; selected_pitch: string | null; candidates: Array<{ rank: number; pitch: string; score: number }> }>>(`/practice-tracks/${trackId}/pitch-events`),
  assetContent: (assetId: number) => `${API_BASE}/audio-assets/${assetId}/content`,
  calibrations: () => request<Array<{ id: number; roundtrip_latency_ms: number; input_device_id: string; output_device_id: string; sample_rate_hz: number }>>("/latency-calibrations"),
  createCalibration: (body: object) => request<{ id: number; roundtrip_latency_ms: number }>("/latency-calibrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  recordings: () => request<ApiRecording[]>("/recording-sessions"),
  uploadRecording: (form: FormData) => request<ApiRecording>("/recording-sessions", { method: "POST", body: form }),
  startAnalysis: (sessionId: number) => request<{ analysis_context_id: number; processing_job_id: number }>(`/recording-sessions/${sessionId}/analyses`, { method: "POST" }),
  analysisResult: (resultId: number) => request<Record<string, number | string | null>>(`/analysis-results/${resultId}`),
  noteEvents: (resultId: number) => request<Array<Record<string, number | string | null>>>(`/analysis-results/${resultId}/note-events`),
  history: () => request<ApiHistory[]>("/history"),
};