import { FileAudio, Search, Video } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useViewState } from "../components/layout/AppLayout";

export function TrackImportPage() {
  const state = useViewState();
  const [method, setMethod] = useState<"local" | "youtube">("local");
  const [metadataVisible, setMetadataVisible] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, string | number | null>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      if (method === "local") await api.importLocal(form);
      else await api.importYoutube({ url: form.get("url"), display_title: form.get("display_title"), song_title: form.get("song_title") || null, artist_name: form.get("artist_name") || null });
      navigate("/tracks");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Import failed"); setSubmitting(false); }
  }
  return <><PageHeader eyebrow="Import" title="練習曲を追加" description="音源を登録し、PracticeTrackを作成" /><ViewStatePanel state={state}><div className="content-grid import-grid">
    <section className="panel"><div className="segment-control"><button className={method === "local" ? "active" : ""} onClick={() => setMethod("local")}><FileAudio /> Local File</button><button className={method === "youtube" ? "active" : ""} onClick={() => setMethod("youtube")}><Video /> YouTube URL</button></div>
      <form className="form" onSubmit={submit}>{method === "local" ? <label className="file-drop"><FileAudio /><strong>音声ファイルを選択</strong><span>WAV / MP3 / M4A / FLAC</span><input name="file" type="file" accept="audio/*" required /></label> : <><label>YouTube URL<div className="inline-field"><input name="url" type="url" defaultValue="https://www.youtube.com/watch?v=xxxxxxxxxxx" /><button type="button" className="button" onClick={(event) => { const input = event.currentTarget.form?.elements.namedItem("url") as HTMLInputElement; api.youtubeMetadata(input.value).then((value) => { setMetadata(value); setMetadataVisible(true); }).catch((reason) => setError(reason.message)); }}><Search />情報取得</button></div></label>{metadataVisible && <div className="source-preview"><span className="video-thumb"><Video /></span><div><strong>{metadata.source_title}</strong><small>{metadata.source_creator} / {metadata.duration_seconds} sec / {metadata.external_id}</small></div></div>}</>}
      <div className="field-grid"><label>表示名<input name="display_title" defaultValue="Sample Song" required /></label><label>曲名 <small>任意</small><input name="song_title" defaultValue="Sample Song" /></label><label>アーティスト <small>任意</small><input name="artist_name" defaultValue="Artist A" /></label></div>{error && <p className="form-error">{error}</p>}<button className="button primary submit" type="submit" disabled={submitting}>{submitting ? "登録中..." : "登録して解析"}</button></form>
    </section><aside className="panel flow-panel"><h3>Import flow</h3>{["MediaSource 登録", "source_audio 生成", "Stem 分離", "楽曲解析"].map((label, index) => <div className="flow-step" key={label}><span>{index + 1}</span><div><strong>{label}</strong><small>{index === 1 ? "ここから共通処理" : "Processing Job"}</small></div></div>)}</aside>
  </div></ViewStatePanel></>;
}