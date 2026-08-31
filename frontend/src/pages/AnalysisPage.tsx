import { Activity, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type ApiAnalysisContext, type ApiAnalysisResult, type ApiNoteEvent, type ApiRecording } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useViewState } from "../components/layout/AppLayout";

const CHART_RANGE_MS = 120;

function format(value: number | null | undefined, digits = 1, unit = ""): string {
  return value === null || value === undefined ? "-" : `${value.toFixed(digits)}${unit}`;
}

export function AnalysisPage() {
  const state = useViewState();
  const [params] = useSearchParams();
  const [sessions, setSessions] = useState<ApiRecording[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [context, setContext] = useState<ApiAnalysisContext | null>(null);
  const [result, setResult] = useState<ApiAnalysisResult | null>(null);
  const [notes, setNotes] = useState<ApiNoteEvent[]>([]);
  const [message, setMessage] = useState("");

  const selected = sessions.find((item) => item.id === sessionId) ?? null;
  const running = Boolean(jobId) && !result;

  useEffect(() => {
    api.recordings().then((items) => {
      setSessions(items);
      const requested = Number(params.get("session_id"));
      setSessionId(items.find((item) => item.id === requested)?.id ?? items[0]?.id ?? null);
    }).catch(() => setMessage("録音セッションを取得できませんでした"));
  }, [params]);

  useEffect(() => {
    if (!sessionId) return;
    setResult(null);
    setNotes([]);
    setJobId(null);
    api.analyses(sessionId).then((items) => {
      const latest = items.find((item) => item.analysis_result_id);
      setContext(latest ?? items[0] ?? null);
      if (latest?.analysis_result_id) void loadResult(latest.analysis_result_id);
    }).catch(() => setContext(null));
  }, [sessionId]);

  useEffect(() => {
    if (!jobId || !sessionId) return;
    const timer = window.setInterval(() => {
      api.job(jobId).then(async (job) => {
        if (job.status === "failed") {
          window.clearInterval(timer);
          setJobId(null);
          setMessage(`解析に失敗しました: ${job.error_message ?? job.status}`);
          return;
        }
        if (job.status !== "succeeded") return;
        window.clearInterval(timer);
        const contexts = await api.analyses(sessionId);
        const finished = contexts.find((item) => item.processing_job_id === jobId);
        setContext(finished ?? null);
        if (finished?.analysis_result_id) await loadResult(finished.analysis_result_id);
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [jobId, sessionId]);

  async function loadResult(resultId: number) {
    const [summary, events] = await Promise.all([api.analysisResult(resultId), api.noteEvents(resultId)]);
    setResult(summary);
    setNotes(events);
    setMessage("");
  }

  async function analyze() {
    if (!sessionId) return;
    setResult(null);
    setNotes([]);
    setMessage("");
    try {
      const accepted = await api.startAnalysis(sessionId);
      setJobId(accepted.processing_job_id);
    } catch (error) {
      setMessage(`解析を開始できませんでした: ${(error as Error).message}`);
    }
  }

  const matched = notes.filter((note) => note.status === "matched" && note.timing_error_ms !== null);

  return <>
    <PageHeader eyebrow="Analysis" title="演奏解析" description="録音セッションを選択して事後解析" />
    <ViewStatePanel state={state}>
      <div className="content-grid analysis-context">
        <section className="panel">
          <div className="panel-title"><h3>Recording Session</h3><span>{sessions.length} sessions</span></div>
          <div className="session-list">{sessions.map((item) => <button className={item.id === sessionId ? "active" : ""} key={item.id} onClick={() => setSessionId(item.id)}>
            <span><strong>{new Date(item.recorded_at).toLocaleString("ja-JP")}</strong><small>Track #{item.practice_track_id} / {item.playback_speed * 100}% / {item.section_start_seconds.toFixed(1)}-{item.section_end_seconds.toFixed(1)}s</small></span>
            <Play />
          </button>)}</div>
        </section>
        <section className="panel">
          <div className="panel-title"><h3>自動取得Context</h3><span>{selected ? `Session #${selected.id}` : "未選択"}</span></div>
          {selected && <dl className="facts two">
            <dt>PracticeTrack</dt><dd>#{selected.practice_track_id}</dd>
            <dt>Section</dt><dd>{selected.section_start_seconds.toFixed(1)} - {selected.section_end_seconds.toFixed(1)} s</dd>
            <dt>Playback speed</dt><dd>{selected.playback_speed * 100}%</dd>
            <dt>Count-in</dt><dd>{selected.count_in_bars} bars</dd>
            <dt>Sample rate</dt><dd>{selected.sample_rate_hz} Hz</dd>
            <dt>Latency offset</dt><dd>{selected.latency_calibration_id ? format(context?.latency_offset_ms, 1, " ms") : "未校正 (0 ms)"}</dd>
            <dt>Onset detector</dt><dd>{context?.onset_detector ?? "-"}</dd>
          </dl>}
          <button className="button primary" disabled={!selected || running} onClick={() => void analyze()}><Activity />{running ? "解析中..." : "解析開始"}</button>
          {message && <p className="notice">{message}</p>}
        </section>
      </div>
      {result && <>
        <div className="metric-grid">
          <article><small>平均タイミング</small><strong className="warm">{format(result.timing_mean_ms, 1, " ms")}</strong><span>符号付き</span></article>
          <article><small>平均絶対誤差</small><strong>{format(result.timing_mae_ms, 1, " ms")}</strong><span>MAE</span></article>
          <article><small>タイミングSD</small><strong>{format(result.timing_std_ms, 1, " ms")}</strong><span>ばらつき</span></article>
          <article><small>音量SD</small><strong>{format(result.level_std_db, 2, " dB")}</strong><span>平均 {format(result.level_mean_db, 1, " dB")}</span></article>
          <article><small>Reference</small><strong>{result.reference_note_count}</strong><span>検出音数</span></article>
          <article><small>Matched</small><strong>{result.matched_note_count}</strong><span>一致</span></article>
          <article><small>Missing</small><strong>{result.missing_note_count}</strong><span>不足</span></article>
          <article><small>Extra</small><strong>{result.extra_note_count}</strong><span>余剰</span></article>
        </div>
        <section className="panel">
          <div className="panel-title"><h3>Timing Error</h3><span>{matched.length} matched events</span></div>
          <div className="timing-chart">
            <i />
            {matched.map((note, index) => <span key={note.id} title={`#${note.event_index} ${format(note.timing_error_ms, 1, " ms")}`} style={{ left: `${((index + 0.5) / matched.length) * 100}%`, top: `${50 - Math.max(-50, Math.min(50, ((note.timing_error_ms ?? 0) / CHART_RANGE_MS) * 100))}%` }} />)}
          </div>
          <div className="chart-legend"><span>上: 走り (-{CHART_RANGE_MS} ms)</span><span>0 ms</span><span>下: 遅れ (+{CHART_RANGE_MS} ms)</span></div>
        </section>
        <section className="panel">
          <div className="panel-title"><h3>Note Events</h3><span>{notes.length} events</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>Reference</th><th>User</th><th>Timing</th><th>Level</th><th>Status</th></tr></thead>
            <tbody>{notes.map((note) => <tr key={note.id}>
              <td>{note.event_index}</td>
              <td>{format(note.reference_time_seconds, 3, " s")}</td>
              <td>{format(note.user_time_seconds, 3, " s")}</td>
              <td>{format(note.timing_error_ms, 1, " ms")}</td>
              <td>{format(note.level_db, 1, " dB")}</td>
              <td><span className={`job-dot ${note.status === "matched" ? "succeeded" : "failed"}`} /> {note.status}</td>
            </tr>)}</tbody>
          </table></div>
        </section>
      </>}
    </ViewStatePanel>
  </>;
}
