import { FileAudio, Search, Video } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useViewState } from "../components/layout/AppLayout";

export function TrackImportPage() {
  const state = useViewState();
  const [method, setMethod] = useState<"local" | "youtube">("local");
  const [metadataVisible, setMetadataVisible] = useState(false);
  return <><PageHeader eyebrow="Import" title="練習曲を追加" description="音源を登録し、PracticeTrackを作成" /><ViewStatePanel state={state}><div className="content-grid import-grid">
    <section className="panel"><div className="segment-control"><button className={method === "local" ? "active" : ""} onClick={() => setMethod("local")}><FileAudio /> Local File</button><button className={method === "youtube" ? "active" : ""} onClick={() => setMethod("youtube")}><Video /> YouTube URL</button></div>
      <form className="form" onSubmit={(event) => event.preventDefault()}>{method === "local" ? <label className="file-drop"><FileAudio /><strong>音声ファイルを選択</strong><span>WAV / MP3 / M4A / FLAC</span><input type="file" accept="audio/*" /></label> : <><label>YouTube URL<div className="inline-field"><input type="url" defaultValue="https://www.youtube.com/watch?v=xxxxxxxxxxx" /><button type="button" className="button" onClick={() => setMetadataVisible(true)}><Search />情報取得</button></div></label>{metadataVisible && <div className="source-preview"><span className="video-thumb"><Video /></span><div><strong>Sample Song Official Video</strong><small>Sample Official / 04:02 / xxxxxxxxxxx</small></div></div>}</>}
      <div className="field-grid"><label>表示名<input defaultValue="Sample Song" required /></label><label>曲名 <small>任意</small><input defaultValue="Sample Song" /></label><label>アーティスト <small>任意</small><input defaultValue="Artist A" /></label></div><button className="button primary submit" type="submit">登録して解析</button></form>
    </section><aside className="panel flow-panel"><h3>Import flow</h3>{["MediaSource 登録", "source_audio 生成", "Stem 分離", "楽曲解析"].map((label, index) => <div className="flow-step" key={label}><span>{index + 1}</span><div><strong>{label}</strong><small>{index === 1 ? "ここから共通処理" : "Processing Job"}</small></div></div>)}</aside>
  </div></ViewStatePanel></>;
}