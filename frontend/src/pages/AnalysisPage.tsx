import { Activity, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type ApiHistory, type ApiRecording } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useViewState } from "../components/layout/AppLayout";

export function AnalysisPage() {
  const state = useViewState(); const [sessions, setSessions] = useState<ApiRecording[]>([]); const [sessionId, setSessionId] = useState<number | null>(null); const [jobId, setJobId] = useState<number | null>(null); const [result, setResult] = useState<ApiHistory | null>(null); const selected = sessions.find((item) => item.id === sessionId);
  useEffect(() => { api.recordings().then((items) => { setSessions(items); setSessionId(items[0]?.id ?? null); }); }, []);
  useEffect(() => { if (!jobId || !sessionId) return; const timer = window.setInterval(() => api.history().then((items) => { const found = items.find((item) => item.recording_session_id === sessionId && item.result_id); if (found) { setResult(found); window.clearInterval(timer); } }), 2000); return () => window.clearInterval(timer); }, [jobId, sessionId]);
  async function analyze() { if (!sessionId) return; const accepted = await api.startAnalysis(sessionId); setJobId(accepted.processing_job_id); setResult(null); }
  return <><PageHeader eyebrow="Analysis" title="演奏解析" description="録音セッションを選択して事後解析" /><ViewStatePanel state={state}><div className="content-grid analysis-context"><section className="panel"><div className="panel-title"><h3>Recording Session</h3><span>{sessions.length} sessions</span></div><div className="session-list">{sessions.map((item) => <button className={item.id === sessionId ? "active" : ""} key={item.id} onClick={() => { setSessionId(item.id); setResult(null); }}><span><strong>{new Date(item.recorded_at).toLocaleString("ja-JP")}</strong><small>Track #{item.practice_track_id} / {item.playback_speed * 100}%</small></span><Play /></button>)}</div></section><section className="panel"><div className="panel-title"><h3>自動取得Context</h3><span>{selected ? `Session #${selected.id}` : "未選択"}</span></div>{selected && <dl className="facts two"><dt>PracticeTrack</dt><dd>#{selected.practice_track_id}</dd><dt>Section</dt><dd>{selected.section_start_seconds} - {selected.section_end_seconds}</dd><dt>Playback speed</dt><dd>{selected.playback_speed * 100}%</dd><dt>Sample rate</dt><dd>{selected.sample_rate_hz} Hz</dd></dl>}<button className="button primary" disabled={!selected || Boolean(jobId && !result)} onClick={() => analyze()}><Activity />{jobId && !result ? "解析中..." : "解析開始"}</button></section></div>
    {result && <div className="metric-grid"><article><small>平均タイミング</small><strong>{result.timing_mean_ms ?? "-"} ms</strong></article><article><small>平均絶対誤差</small><strong>{result.timing_mae_ms ?? "-"} ms</strong></article><article><small>音量ばらつき</small><strong>{result.level_std_db ?? "-"} dB</strong></article><article><small>Missing / Extra</small><strong>{result.missing_note_count ?? 0} / {result.extra_note_count ?? 0}</strong></article></div>}
  </ViewStatePanel></>;
}
