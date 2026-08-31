import { Check, Pause, Play, Repeat2, SkipBack } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type ApiChord, type ApiPitch } from "../api/client";
import { Waveform } from "../components/audio/Waveform";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { useSelectedTrack, useViewState } from "../components/layout/AppLayout";
import { formatClock } from "../services/timeline";

const SOURCES = [["source_audio", "Source"], ["stem_bass", "Bass Solo"], ["bass_mute", "Bass Mute"]] as const;
const SPEEDS = [0.5, 0.75, 1];

export function EarCopyPage() {
  const state = useViewState();
  const trackId = Number(useParams().id);
  const { selectTrack } = useSelectedTrack();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [source, setSource] = useState<string>("source_audio");
  const [summary, setSummary] = useState<{ bpm: number | null; musical_key: string | null; time_signature: { numerator: number | null; denominator: number | null }; assets: Record<string, number> }>({ bpm: null, musical_key: null, time_signature: { numerator: null, denominator: null }, assets: {} });
  const [chords, setChords] = useState<ApiChord[]>([]);
  const [pitches, setPitches] = useState<ApiPitch[]>([]);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loop, setLoop] = useState<{ start: number | null; end: number | null }>({ start: null, end: null });
  const [looping, setLooping] = useState(false);
  const [pitchId, setPitchId] = useState<number | null>(null);
  const [chordDraft, setChordDraft] = useState("");
  const [notice, setNotice] = useState("");

  const assetId = summary.assets[source];
  const activePitch = pitches.find((item) => item.id === pitchId) ?? pitches[0] ?? null;
  const activeChord = useMemo(() => chords.find((chord) => currentTime >= chord.start_seconds && currentTime < chord.end_seconds) ?? null, [chords, currentTime]);

  useEffect(() => {
    selectTrack(trackId);
    api.musicalAnalysis(trackId).then(setSummary).catch(() => setNotice("楽曲解析を取得できませんでした"));
    api.chords(trackId).then(setChords).catch(() => setChords([]));
    api.pitches(trackId).then((events) => { setPitches(events); setPitchId(events[0]?.id ?? null); }).catch(() => setPitches([]));
  }, [trackId]);

  useEffect(() => { setChordDraft(activeChord?.selected_chord ?? ""); }, [activeChord?.id]);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.src = assetId ? api.assetContent(assetId) : "";
    setPlaying(false);
    setCurrentTime(0);
  }, [assetId]);

  useEffect(() => {
    if (!assetId) { setBuffer(null); return; }
    let active = true;
    const context = new AudioContext();
    fetch(api.assetContent(assetId))
      .then((response) => response.arrayBuffer())
      .then((encoded) => context.decodeAudioData(encoded))
      .then((decoded) => { if (active) setBuffer(decoded); })
      .catch(() => { if (active) setBuffer(null); })
      .finally(() => context.close());
    return () => { active = false; };
  }, [assetId]);

  function onTimeUpdate() {
    const element = audio.current;
    if (!element) return;
    if (looping && loop.start !== null && loop.end !== null && loop.end > loop.start && element.currentTime >= loop.end) element.currentTime = loop.start;
    setCurrentTime(element.currentTime);
  }

  function seek(seconds: number) {
    if (audio.current) audio.current.currentTime = seconds;
    setCurrentTime(seconds);
  }

  function toggle() {
    const element = audio.current;
    if (!element?.src) return;
    if (playing) element.pause(); else void element.play();
    setPlaying(!playing);
  }

  async function saveChord() {
    if (!activeChord || !chordDraft.trim()) return;
    const updated = await api.patchChord(activeChord.id, { selected_chord: chordDraft.trim() });
    setChords((items) => items.map((chord) => (chord.id === updated.id ? updated : chord)));
    setNotice(`Chord #${updated.id} を更新しました`);
  }

  async function selectCandidate(candidate: { pitch: string; midi_note: number }) {
    if (!activePitch) return;
    await api.patchPitch(activePitch.id, { selected_pitch: candidate.pitch, selected_midi_note: candidate.midi_note });
    setPitches((items) => items.map((item) => (item.id === activePitch.id ? { ...item, selected_pitch: candidate.pitch, selected_midi_note: candidate.midi_note, is_user_corrected: true } : item)));
    setNotice(`Pitch #${activePitch.id} を ${candidate.pitch} に修正しました`);
  }

  return <>
    <PageHeader eyebrow="Ear copy" title="耳コピ支援" description={`PracticeTrack #${trackId}`} />
    <ViewStatePanel state={state}>
      <div className="content-grid player-grid">
        <section className="panel player-panel">
          <audio ref={audio} preload="auto" onTimeUpdate={onTimeUpdate} onEnded={() => setPlaying(false)} />
          <div className="segment-control compact">{SOURCES.map(([value, label]) => <button key={value} disabled={!summary.assets[value]} className={source === value ? "active" : ""} onClick={() => setSource(value)}>{label}</button>)}</div>
          <Waveform buffer={buffer} currentTime={currentTime} chords={chords} pitches={pitches} activePitchId={activePitch?.id ?? null} loopStart={looping ? loop.start : null} loopEnd={looping ? loop.end : null} onSeek={seek} onSelectPitch={(pitch) => { setPitchId(pitch.id); seek(pitch.onset_seconds); }} />
          <div className="transport">
            <button className="icon-button" title="先頭へ" onClick={() => seek(0)}><SkipBack /></button>
            <button className="play-button" title={playing ? "一時停止" : "再生"} onClick={toggle}>{playing ? <Pause /> : <Play />}</button>
            <strong>{formatClock(currentTime)}</strong>
            <div className="transport-spacer" />
            <label>速度<select defaultValue="1" onChange={(event) => { if (audio.current) { audio.current.playbackRate = Number(event.target.value); audio.current.preservesPitch = true; } }}>{SPEEDS.map((value) => <option key={value} value={value}>{value * 100}%</option>)}</select></label>
            <button className="button" onClick={() => setLoop((current) => ({ ...current, start: currentTime }))}>A点 {loop.start !== null ? formatClock(loop.start) : ""}</button>
            <button className="button" onClick={() => setLoop((current) => ({ ...current, end: currentTime }))}>B点 {loop.end !== null ? formatClock(loop.end) : ""}</button>
            <button className={`icon-button ${looping ? "active" : ""}`} title="A-Bループ" disabled={loop.start === null || loop.end === null} onClick={() => setLooping(!looping)}><Repeat2 /></button>
          </div>
        </section>
        <aside className="side-stack">
          <section className="panel">
            <div className="panel-title"><h3>楽曲解析</h3><span>現在値</span></div>
            <div className="metric-pair">
              <div><small>Key</small><strong>{summary.musical_key ?? "-"}</strong></div>
              <div><small>BPM</small><strong>{summary.bpm?.toFixed(1) ?? "-"}</strong></div>
              <div><small>Time signature</small><strong>{summary.time_signature.numerator ?? "-"}/{summary.time_signature.denominator ?? "-"}</strong></div>
              <div><small>Current chord</small><strong>{activeChord?.selected_chord ?? "-"}</strong></div>
            </div>
            <div className="chord-editor">
              <label>Chord修正<input value={chordDraft} disabled={!activeChord} onChange={(event) => setChordDraft(event.target.value)} placeholder="Am7" /></label>
              <button className="button primary" disabled={!activeChord || !chordDraft.trim()} onClick={() => void saveChord()}><Check />選択中Chordを保存</button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-title"><h3>Pitch Hint</h3><span>{activePitch?.candidates.length ?? 0} candidates</span></div>
            <div className="candidate-list">{(activePitch?.candidates ?? []).map((candidate) => <button key={candidate.rank} className={activePitch?.selected_pitch === candidate.pitch ? "active" : ""} onClick={() => void selectCandidate(candidate)}>
              <strong>{candidate.pitch}</strong>
              <span>Score {Math.round(candidate.score * 100)}</span>
              <i style={{ width: `${candidate.score * 100}%` }} />
            </button>)}</div>
            {notice && <p className="notice">{notice}</p>}
          </section>
        </aside>
      </div>
    </ViewStatePanel>
  </>;
}