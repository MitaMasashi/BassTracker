import { Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type ApiHistory } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useViewState } from "../components/layout/AppLayout";

export function HistoryPage() {
  const state = useViewState(); const [items, setItems] = useState<ApiHistory[]>([]); useEffect(() => { api.history().then(setItems); }, []);
  return <><PageHeader eyebrow="History" title="練習履歴" description="同じ曲と区間の変化を時系列で確認" actions={<button className="button"><Filter />Filter</button>} /><ViewStatePanel state={state}><section className="panel history-summary"><div><small>PracticeTrack</small><strong>{items[0]?.practice_track ?? "-"}</strong></div><div><small>Sessions</small><strong>{items.length}</strong></div><div className="trend"><span>MAE trend</span>{items.map((item) => <i key={item.recording_session_id} style={{ height: `${Math.min(60, item.timing_mae_ms ?? 1)}px` }} />)}</div></section><section className="panel table-wrap history-table"><table><thead><tr><th>Date</th><th>PracticeTrack</th><th>Section</th><th>Speed</th><th>Timing MAE</th><th>Timing SD</th><th>Volume SD</th><th>Missing / Extra</th></tr></thead><tbody>{items.map((item) => <tr key={item.recording_session_id}><td>{new Date(item.recorded_at).toLocaleDateString("ja-JP")}</td><td><strong>{item.practice_track}</strong></td><td>{item.section_start_seconds} - {item.section_end_seconds}</td><td>{item.playback_speed * 100}%</td><td>{item.timing_mae_ms ?? "-"} ms</td><td>{item.timing_std_ms ?? "-"} ms</td><td>{item.level_std_db ?? "-"} dB</td><td>{item.missing_note_count ?? "-"} / {item.extra_note_count ?? "-"}</td></tr>)}</tbody></table></section></ViewStatePanel></>;
}