import { Filter, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ApiHistory } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useViewState } from "../components/layout/AppLayout";

interface HistoryFilters {
  trackId: string;
  from: string;
  to: string;
  sectionStart: string;
  sectionEnd: string;
}

const EMPTY_FILTERS: HistoryFilters = { trackId: "", from: "", to: "", sectionStart: "", sectionEnd: "" };
const METRICS = [
  { key: "timing_mae_ms", label: "Timing MAE", unit: "ms", digits: 1 },
  { key: "timing_std_ms", label: "Timing SD", unit: "ms", digits: 1 },
  { key: "level_std_db", label: "Level SD", unit: "dB", digits: 2 },
  { key: "missing_note_count", label: "Missing", unit: "", digits: 0 },
] as const;

function format(value: number | null, digits = 1, unit = ""): string {
  return value === null ? "-" : `${value.toFixed(digits)}${unit}`;
}

function groupKey(item: ApiHistory): string {
  return `${item.practice_track_id}:${item.section_start_seconds.toFixed(3)}:${item.section_end_seconds.toFixed(3)}`;
}

function groupLabel(item: ApiHistory): string {
  return `${item.practice_track} / ${item.section_start_seconds.toFixed(1)}–${item.section_end_seconds.toFixed(1)} s`;
}

function localDateBoundary(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`).toISOString();
}

export function HistoryPage() {
  const forcedState = useViewState();
  const [items, setItems] = useState<ApiHistory[]>([]);
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [trackOptions, setTrackOptions] = useState<Array<{ id: number; title: string }>>([]);
  const [comparisonKey, setComparisonKey] = useState("");
  const [requestState, setRequestState] = useState<"normal" | "loading" | "empty" | "error">("loading");

  useEffect(() => {
    let active = true;
    setRequestState("loading");
    api.history({
      practice_track_id: filters.trackId ? Number(filters.trackId) : undefined,
      section_start_seconds: filters.sectionStart ? Number(filters.sectionStart) : undefined,
      section_end_seconds: filters.sectionEnd ? Number(filters.sectionEnd) : undefined,
      from: localDateBoundary(filters.from),
      to: localDateBoundary(filters.to, true),
    }).then((rows) => {
      if (!active) return;
      setItems(rows);
      setTrackOptions((current) => {
        const options = new Map(current.map((item) => [item.id, item.title]));
        rows.forEach((item) => options.set(item.practice_track_id, item.practice_track));
        return [...options].map(([id, title]) => ({ id, title })).sort((left, right) => left.title.localeCompare(right.title, "ja"));
      });
      setRequestState(rows.length ? "normal" : "empty");
    }).catch(() => {
      if (active) setRequestState("error");
    });
    return () => { active = false; };
  }, [filters.trackId, filters.from, filters.to, filters.sectionStart, filters.sectionEnd]);

  const groups = useMemo(() => {
    const unique = new Map<string, ApiHistory>();
    items.forEach((item) => unique.set(groupKey(item), item));
    return [...unique.entries()];
  }, [items]);

  useEffect(() => {
    if (!groups.some(([key]) => key === comparisonKey)) setComparisonKey(groups[0]?.[0] ?? "");
  }, [groups, comparisonKey]);

  const activeComparisonKey = groups.some(([key]) => key === comparisonKey)
    ? comparisonKey
    : groups[0]?.[0] ?? "";
  const comparison = useMemo(
    () => items.filter((item) => groupKey(item) === activeComparisonKey).sort((left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime()),
    [items, activeComparisonKey],
  );
  const state = forcedState === "normal" ? requestState : forcedState;

  return <>
    <PageHeader eyebrow="History" title="練習履歴" description="同じ曲と区間の変化を時系列で確認" actions={<button className="button" onClick={() => setFilters(EMPTY_FILTERS)}><RotateCcw />条件をクリア</button>} />
    <section className="panel history-filters">
      <div className="panel-title"><h3><Filter /> Filter</h3><span>Track・日付・区間</span></div>
      <div className="filter-grid">
        <label>PracticeTrack<select value={filters.trackId} onChange={(event) => setFilters({ ...filters, trackId: event.target.value })}><option value="">すべて</option>{trackOptions.map((track) => <option value={track.id} key={track.id}>{track.title}</option>)}</select></label>
        <label>開始日<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label>終了日<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
        <label>Section A<input type="number" min="0" step="0.1" placeholder="秒" value={filters.sectionStart} onChange={(event) => setFilters({ ...filters, sectionStart: event.target.value })} /></label>
        <label>Section B<input type="number" min="0" step="0.1" placeholder="秒" value={filters.sectionEnd} onChange={(event) => setFilters({ ...filters, sectionEnd: event.target.value })} /></label>
      </div>
    </section>
    <ViewStatePanel state={state}>
      <section className="panel history-summary">
        <div><small>Comparison</small><strong>{comparison[0] ? groupLabel(comparison[0]) : "-"}</strong></div>
        <div><small>Sessions</small><strong>{comparison.length}</strong></div>
        <label>比較対象<select value={activeComparisonKey} onChange={(event) => setComparisonKey(event.target.value)}>{groups.map(([key, item]) => <option value={key} key={key}>{groupLabel(item)}</option>)}</select></label>
      </section>
      <section className="panel comparison-panel">
        <div className="panel-title"><h3>指標推移</h3><span>古い → 新しい／速度を併記</span></div>
        <div className="comparison-chart">{METRICS.map((metric) => {
          const values = comparison.map((item) => item[metric.key]).filter((value): value is number => value !== null);
          const maximum = Math.max(...values.map(Math.abs), 1);
          return <div className="trend-row" key={metric.key}>
            <strong>{metric.label}</strong>
            <div className="trend-bars">{comparison.map((item) => {
              const value = item[metric.key];
              const height = value === null ? 3 : Math.max(6, (Math.abs(value) / maximum) * 72);
              return <span key={item.recording_session_id} title={`${new Date(item.recorded_at).toLocaleString("ja-JP")} / ${item.playback_speed * 100}% / ${format(value, metric.digits, metric.unit)}`}><i style={{ height: `${height}px` }} /><small>{item.playback_speed * 100}%</small></span>;
            })}</div>
          </div>;
        })}</div>
      </section>
      <section className="panel table-wrap history-table"><table><thead><tr><th>Date</th><th>PracticeTrack</th><th>Section</th><th>Speed</th><th>Timing Mean</th><th>Timing MAE</th><th>Timing SD</th><th>Volume SD</th><th>Matched</th><th>Missing / Extra</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.recording_session_id}><td>{new Date(item.recorded_at).toLocaleString("ja-JP")}</td><td><strong>{item.practice_track}</strong></td><td>{item.section_start_seconds.toFixed(1)} - {item.section_end_seconds.toFixed(1)} s</td><td>{item.playback_speed * 100}%</td><td>{format(item.timing_mean_ms, 1, " ms")}</td><td>{format(item.timing_mae_ms, 1, " ms")}</td><td>{format(item.timing_std_ms, 1, " ms")}</td><td>{format(item.level_std_db, 2, " dB")}</td><td>{item.matched_note_count ?? "-"}</td><td>{item.missing_note_count ?? "-"} / {item.extra_note_count ?? "-"}</td><td><Link className="button" to={`/analysis?session_id=${item.recording_session_id}${item.result_id ? `&result_id=${item.result_id}` : ""}`}>詳細</Link></td></tr>)}</tbody></table></section>
    </ViewStatePanel>
  </>;
}
