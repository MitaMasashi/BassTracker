import { Filter } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useViewState } from "../components/layout/AppLayout";
import { recordings } from "../mocks/mockData";

export function HistoryPage() {
  const state = useViewState(); const metrics = [[24, 17, 2.1, 7, 4], [31, 22, 2.6, 10, 5], [42, 29, 3.3, 15, 7]];
  return <><PageHeader eyebrow="History" title="練習履歴" description="同じ曲と区間の変化を時系列で確認" actions={<button className="button"><Filter />Filter</button>} /><ViewStatePanel state={state}><section className="panel history-summary"><div><small>PracticeTrack</small><strong>Sample Song</strong></div><div><small>Section</small><strong>01:20 - 01:32</strong></div><div><small>Sessions</small><strong>3</strong></div><div className="trend"><span>MAE trend</span>{metrics.map((metric, index) => <i key={index} style={{ height: `${metric[0] * 1.5}px` }} />)}</div></section><section className="panel table-wrap history-table"><table><thead><tr><th>Date</th><th>PracticeTrack</th><th>Section</th><th>Speed</th><th>Timing MAE</th><th>Timing SD</th><th>Volume SD</th><th>Missing / Extra</th></tr></thead><tbody>{recordings.map((recording, index) => <tr key={recording.id}><td>{new Date(recording.recordedAt).toLocaleDateString("ja-JP")}</td><td><strong>Sample Song</strong></td><td>01:20 - 01:32</td><td>{recording.playbackSpeed * 100}%</td><td>{metrics[index][0]} ms</td><td>{metrics[index][1]} ms</td><td>{metrics[index][2]} dB</td><td>{metrics[index][3]} / {metrics[index][4]}</td></tr>)}</tbody></table></section></ViewStatePanel></>;
}