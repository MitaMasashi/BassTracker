import { Pause, Play, Repeat2, SkipBack } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { WaveformMock } from "../components/audio/WaveformMock";
import { useViewState } from "../components/layout/AppLayout";
import { pitchEvents, tracks } from "../mocks/mockData";

export function EarCopyPage() {
  const state = useViewState(); const [playing, setPlaying] = useState(false); const [source, setSource] = useState("Source");
  return <><PageHeader eyebrow="Ear copy" title="耳コピ支援" description={tracks[0].displayTitle} actions={<button className="button">Chord編集</button>} /><ViewStatePanel state={state}><div className="content-grid player-grid"><section className="panel player-panel">
    <div className="segment-control compact">{["Source", "Bass Solo", "Bass Mute"].map((item) => <button key={item} className={source === item ? "active" : ""} onClick={() => setSource(item)}>{item}</button>)}</div><WaveformMock />
    <div className="transport"><button className="icon-button" title="先頭へ"><SkipBack /></button><button className="play-button" title={playing ? "一時停止" : "再生"} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</button><strong>01:24.2</strong><span>/ 03:42.0</span><div className="transport-spacer" /><label>速度<select defaultValue="1"><option value=".5">50%</option><option value=".75">75%</option><option value="1">100%</option></select></label><button className="button">A点</button><button className="button">B点</button><button className="icon-button active" title="A-Bループ"><Repeat2 /></button></div>
  </section><aside className="side-stack"><section className="panel"><div className="panel-title"><h3>楽曲解析</h3><span>現在位置</span></div><div className="metric-pair"><div><small>Key</small><strong>E minor</strong></div><div><small>BPM</small><strong>118</strong></div></div><dl className="facts"><dt>拍子</dt><dd>4 / 4</dd><dt>Current chord</dt><dd>G</dd></dl></section><section className="panel"><div className="panel-title"><h3>Pitch Hint</h3><span>01:24.382</span></div><div className="candidate-list">{pitchEvents[0].candidates.map((candidate) => <button key={candidate.rank}><strong>{candidate.pitch}</strong><span>Score {Math.round(candidate.score * 100)}</span><i style={{ width: `${candidate.score * 100}%` }} /></button>)}</div></section></aside></div></ViewStatePanel></>;
}