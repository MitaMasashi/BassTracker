import { ArrowRight, Pencil, RotateCcw } from "lucide-react";
import { TrackInfoEditor } from "../components/track/TrackInfoEditor";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useSelectedTrack, useViewState } from "../components/layout/AppLayout";
import { api, type ApiJob, type ApiTrack } from "../api/client";

const statusLabels = { registered: "登録済み", processing: "処理中", ready: "Ready", partial: "一部利用可", error: "エラー" };

export function LibraryPage() {
  const forcedState = useViewState();
  const { selectTrack } = useSelectedTrack();
  const [tracks, setTracks] = useState<ApiTrack[]>([]);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [requestState, setRequestState] = useState<"normal" | "loading" | "empty" | "error">("loading");
  useEffect(() => { api.tracks().then(({ items }) => { setTracks(items); setSelectedId(items[0]?.id ?? null); setRequestState(items.length ? "normal" : "empty"); }).catch(() => setRequestState("error")); }, []);
  useEffect(() => { if (selectedId) selectTrack(selectedId); setEditing(false); setNotice(""); }, [selectedId, selectTrack]);
  useEffect(() => { if (!selectedId) return; const load = () => api.jobs(selectedId).then(setJobs).catch(() => setJobs([])); load(); const timer = window.setInterval(load, 2000); return () => window.clearInterval(timer); }, [selectedId]);
  const state = forcedState === "normal" ? requestState : forcedState;
  const selected = tracks.find((track) => track.id === selectedId);
  return <>
    <PageHeader eyebrow="Library" title="ライブラリ" description="練習曲と解析状況をまとめて確認" actions={<Link className="button primary" to="/tracks/new">練習曲を追加 <ArrowRight /></Link>} />
    <ViewStatePanel state={state}>{selected && <div className="content-grid library-grid">
      <section className="panel"><div className="panel-title"><h3>PracticeTrack</h3><span>{tracks.length} tracks</span></div><div className="track-list">{tracks.map((track) => <button key={track.id} className={`track-row ${track.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(track.id)}><span className="track-art">AUDIO</span><span className="track-main"><strong>{track.display_title}</strong><small>{track.song_title ?? "曲名未設定"} / {track.artist_name ?? "Artist未設定"}</small><span><i className={`status ${track.status}`}>{statusLabels[track.status as keyof typeof statusLabels] ?? track.status}</i></span></span><span className="track-meta">{track.musical_key ?? "解析中"}<small>{track.bpm ? `${track.bpm} BPM` : "-"}</small></span></button>)}</div></section>
      <div className="side-stack"><section className="panel"><div className="panel-title"><h3>選択中のトラック</h3><span className={`status ${selected.status}`}>{statusLabels[selected.status as keyof typeof statusLabels] ?? selected.status}</span></div>{editing
        ? <TrackInfoEditor key={selected.id} track={selected} onCancel={() => setEditing(false)} onSaved={(updated) => { setTracks((items) => items.map((item) => (item.id === updated.id ? updated : item))); setEditing(false); setNotice("曲情報を保存しました"); }} />
        : <><dl className="facts"><dt>表示名</dt><dd>{selected.display_title}</dd><dt>曲名</dt><dd>{selected.song_title ?? "未設定"}</dd><dt>アーティスト</dt><dd>{selected.artist_name ?? "未設定"}</dd><dt>BPM / Key</dt><dd>{selected.bpm !== null ? Number(selected.bpm.toFixed(2)) : "-"} / {selected.musical_key ?? "-"}</dd><dt>拍子</dt><dd>{selected.time_signature_numerator && selected.time_signature_denominator ? `${selected.time_signature_numerator}/${selected.time_signature_denominator}` : "未設定 (4/4として扱う)"}</dd></dl>{notice && <p className="notice">{notice}</p>}<div className="button-row"><Link className="button primary" to={`/tracks/${selected.id}/ear-copy`}>耳コピを開く</Link><Link className="button" to={`/tracks/${selected.id}/practice`}>練習する</Link><button className="button" onClick={() => { setNotice(""); setEditing(true); }}><Pencil />情報を編集</button></div></>}</section>
      <section className="panel"><div className="panel-title"><h3>Processing Jobs</h3><span>2秒ごとに更新</span></div><div className="job-list">{jobs.map((job) => <div className="job-row" key={job.id}><span className={`job-dot ${job.status}`} /><div><strong>{job.job_type}</strong><small>{job.error_message ?? job.status}</small></div><span className={`status ${job.status}`}>{job.status}</span>{job.status === "failed" && <button className="icon-button" title="再試行" onClick={() => api.retryJob(job.id).then(() => api.jobs(selected.id).then(setJobs))}><RotateCcw /></button>}</div>)}</div></section></div>
    </div>}</ViewStatePanel>
  </>;
}