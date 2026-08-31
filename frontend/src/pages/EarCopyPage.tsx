import { Pause, Play, Repeat2, SkipBack } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { WaveformMock } from "../components/audio/WaveformMock";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useViewState } from "../components/layout/AppLayout";

export function EarCopyPage() {
  const state = useViewState(); const trackId = Number(useParams().id); const audio = useRef<HTMLAudioElement>(null); const [playing, setPlaying] = useState(false); const [source, setSource] = useState("source_audio"); const [summary, setSummary] = useState<{ bpm: number | null; musical_key: string | null; assets: Record<string, number> }>({ bpm: null, musical_key: null, assets: {} }); const [candidates, setCandidates] = useState<Array<{ rank: number; pitch: string; score: number }>>([]);
  useEffect(() => { api.musicalAnalysis(trackId).then(setSummary); api.pitches(trackId).then((events) => setCandidates(events[0]?.candidates ?? [])); }, [trackId]);
  useEffect(() => { if (!audio.current) return; audio.current.src = summary.assets[source] ? api.assetContent(summary.assets[source]) : ""; setPlaying(false); }, [source, summary.assets]);
  const toggle = () => { if (!audio.current?.src) return; playing ? audio.current.pause() : audio.current.play(); setPlaying(!playing); };
  return <><PageHeader eyebrow="Ear copy" title="耳コピ支援" description={`PracticeTrack #${trackId}`} /><ViewStatePanel state={state}><div className="content-grid player-grid"><section className="panel player-panel"><audio ref={audio} preload="auto" />
    <div className="segment-control compact">{[["source_audio","Source"],["stem_bass","Bass Solo"],["bass_mute","Bass Mute"]].map(([value,label]) => <button key={value} disabled={!summary.assets[value]} className={source === value ? "active" : ""} onClick={() => setSource(value)}>{label}</button>)}</div><WaveformMock />
    <div className="transport"><button className="icon-button" title="先頭へ" onClick={() => { if (audio.current) audio.current.currentTime = 0; }}><SkipBack /></button><button className="play-button" title={playing ? "一時停止" : "再生"} onClick={toggle}>{playing ? <Pause /> : <Play />}</button><strong>Audio</strong><div className="transport-spacer" /><label>速度<select defaultValue="1" onChange={(event) => { if (audio.current) { audio.current.playbackRate = Number(event.target.value); audio.current.preservesPitch = true; } }}><option value=".5">50%</option><option value=".75">75%</option><option value="1">100%</option></select></label><button className="button">A点</button><button className="button">B点</button><button className="icon-button active" title="A-Bループ"><Repeat2 /></button></div>
  </section><aside className="side-stack"><section className="panel"><div className="panel-title"><h3>楽曲解析</h3><span>現在値</span></div><div className="metric-pair"><div><small>Key</small><strong>{summary.musical_key ?? "-"}</strong></div><div><small>BPM</small><strong>{summary.bpm ?? "-"}</strong></div></div></section><section className="panel"><div className="panel-title"><h3>Pitch Hint</h3><span>{candidates.length} candidates</span></div><div className="candidate-list">{candidates.map((candidate) => <button key={candidate.rank}><strong>{candidate.pitch}</strong><span>Score {Math.round(candidate.score * 100)}</span><i style={{ width: `${candidate.score * 100}%` }} /></button>)}</div></section></aside></div></ViewStatePanel></>;
}