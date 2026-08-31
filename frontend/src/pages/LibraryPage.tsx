import { ArrowRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useViewState } from "../components/layout/AppLayout";
import { jobs, tracks } from "../mocks/mockData";

const statusLabels = { registered: "登録済み", processing: "処理中", ready: "Ready", partial: "一部利用可", error: "エラー" };

export function LibraryPage() {
  const state = useViewState();
  const [selectedId, setSelectedId] = useState(tracks[0].id);
  const selected = tracks.find((track) => track.id === selectedId) ?? tracks[0];
  return <>
    <PageHeader eyebrow="Library" title="ライブラリ" description="練習曲と解析状況をまとめて確認" actions={<Link className="button primary" to="/tracks/new">練習曲を追加 <ArrowRight /></Link>} />
    <ViewStatePanel state={state}><div className="content-grid library-grid">
      <section className="panel"><div className="panel-title"><h3>PracticeTrack</h3><span>{tracks.length} tracks</span></div><div className="track-list">{tracks.map((track) => <button key={track.id} className={`track-row ${track.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(track.id)}><span className="track-art">{track.sourceType === "youtube" ? "YT" : "WAV"}</span><span className="track-main"><strong>{track.displayTitle}</strong><small>{track.songTitle ?? "曲名未設定"} / {track.artistName ?? "Artist未設定"}</small><span><i className={`status ${track.status}`}>{statusLabels[track.status]}</i> {track.sourceType === "youtube" ? "YouTube" : "Local file"}</span></span><span className="track-meta">{track.musicalKey ?? "解析中"}<small>{track.bpm ? `${track.bpm} BPM` : "-"}</small></span></button>)}</div></section>
      <div className="side-stack"><section className="panel"><div className="panel-title"><h3>選択中のトラック</h3><span className={`status ${selected.status}`}>{statusLabels[selected.status]}</span></div><dl className="facts"><dt>表示名</dt><dd>{selected.displayTitle}</dd><dt>曲名</dt><dd>{selected.songTitle ?? "未設定"}</dd><dt>アーティスト</dt><dd>{selected.artistName ?? "未設定"}</dd><dt>BPM / Key</dt><dd>{selected.bpm ?? "-"} / {selected.musicalKey ?? "-"}</dd></dl><div className="button-row"><Link className="button primary" to={`/tracks/${selected.id}/ear-copy`}>耳コピを開く</Link><Link className="button" to={`/tracks/${selected.id}/practice`}>練習する</Link></div></section>
      <section className="panel"><div className="panel-title"><h3>Processing Jobs</h3><span>最新</span></div><div className="job-list">{jobs.map((job) => <div className="job-row" key={job.id}><span className={`job-dot ${job.status}`} /><div><strong>{job.jobType}</strong><small>{job.errorMessage ?? job.status}</small></div><span className={`status ${job.status}`}>{job.status}</span>{job.status === "failed" && <button className="icon-button" title="再試行"><RotateCcw /></button>}</div>)}</div></section></div>
    </div></ViewStatePanel>
  </>;
}