import { Gauge, Mic2, Radio, SlidersHorizontal, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type ApiCalibration } from "../api/client";
import { PracticeAudioEngine } from "../services/practiceAudioEngine";
import { formatClock } from "../services/timeline";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { Waveform } from "../components/audio/Waveform";
import { useSelectedTrack, useViewState } from "../components/layout/AppLayout";

const SPEEDS = [0.75, 0.9, 1];
const COUNT_IN_BARS = [0, 1, 2];
const ACCOMPANIMENT = [{ value: "bass_mute", label: "Bass Mute" }, { value: "source_audio", label: "Source" }];

interface PendingUpload { blob: Blob; metadata: Record<string, unknown> }

export function PracticePage() {
  const state = useViewState();
  const trackId = Number(useParams().id);
  const { selectTrack } = useSelectedTrack();
  const engine = useRef(new PracticeAudioEngine());
  const [summary, setSummary] = useState<{ bpm: number | null; time_signature: { numerator: number | null }; assets: Record<string, number> }>({ bpm: null, time_signature: { numerator: null }, assets: {} });
  const [accompaniment, setAccompaniment] = useState("bass_mute");
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [preloading, setPreloading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [countInBars, setCountInBars] = useState(2);
  const [useRange, setUseRange] = useState(true);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [calibrations, setCalibrations] = useState<ApiCalibration[]>([]);
  const [calibrationId, setCalibrationId] = useState<number | null>(null);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [sampleRate, setSampleRate] = useState(48000);
  const [message, setMessage] = useState("Audio Inputを選択してください");

  const beatsPerBar = summary.time_signature.numerator ?? 4;
  const bpm = summary.bpm ?? 120;
  const assetId = summary.assets[accompaniment];
  const duration = buffer?.duration ?? 0;
  const section = useRange ? range : { start: 0, end: duration };
  const calibration = calibrations.find((item) => item.id === calibrationId);
  const ready = Boolean(buffer) && Boolean(deviceId) && section.end > section.start;

  useEffect(() => { selectTrack(trackId); api.musicalAnalysis(trackId).then(setSummary).catch(() => setMessage("楽曲情報を取得できませんでした")); }, [trackId]);

  useEffect(() => {
    engine.current.devices()
      .then((items) => { setDevices(items); setDeviceId(items[0]?.deviceId ?? ""); })
      .catch(() => setMessage("マイク権限が必要です"));
  }, []);

  useEffect(() => {
    if (!assetId) { setBuffer(null); return; }
    let active = true;
    setPreloading(true);
    setBuffer(null);
    engine.current.load(api.assetContent(assetId))
      .then((decoded) => { if (!active) return; setBuffer(decoded); setSampleRate(engine.current.sampleRate); setRange({ start: 0, end: Number(decoded.duration.toFixed(2)) }); setMessage("伴奏のロードが完了しました"); })
      .catch(() => { if (active) setMessage("伴奏を読み込めませんでした"); })
      .finally(() => { if (active) setPreloading(false); });
    return () => { active = false; };
  }, [assetId]);

  useEffect(() => {
    if (!deviceId) return;
    api.calibrations({ input_device_id: deviceId, output_device_id: "default", sample_rate_hz: sampleRate })
      .then((items) => { setCalibrations(items); setCalibrationId(items[0]?.id ?? null); })
      .catch(() => setCalibrations([]));
  }, [deviceId, sampleRate]);

  useEffect(() => {
    if (!recording) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => { setElapsed((performance.now() - startedAt) / 1000); setLevel(engine.current.inputLevel()); }, 100);
    return () => window.clearInterval(timer);
  }, [recording]);

  const upload = useCallback(async (payload: PendingUpload) => {
    const form = new FormData();
    form.append("file", payload.blob, "recording.wav");
    form.append("metadata_json", JSON.stringify(payload.metadata));
    await api.uploadRecording(form);
  }, []);

  async function toggleRecording() {
    if (!recording) {
      if (!ready) { setMessage("伴奏のロードとInput選択が必要です"); return; }
      setElapsed(0);
      await engine.current.start({ deviceId, buffer, sectionStartSeconds: section.start, sectionEndSeconds: section.end, playbackSpeed: speed, countInBars, bpm, beatsPerBar });
      setRecording(true);
      setMessage("録音中");
      return;
    }
    const { blob, sampleRate: rate } = await engine.current.stop();
    setRecording(false);
    const payload: PendingUpload = { blob, metadata: { practice_track_id: trackId, section_start_seconds: section.start, section_end_seconds: section.end, playback_speed: speed, count_in_bars: countInBars, sample_rate_hz: rate, audio_input_device_id: deviceId, audio_output_device_id: "default", latency_calibration_id: calibrationId } };
    try {
      await upload(payload);
      setPending(null);
      setMessage("録音を保存しました");
    } catch (error) {
      setPending(payload);
      setMessage(`Uploadに失敗しました: ${(error as Error).message}`);
    }
  }

  async function retryUpload() {
    if (!pending) return;
    try {
      await upload(pending);
      setPending(null);
      setMessage("録音を保存しました");
    } catch (error) {
      setMessage(`Uploadに失敗しました: ${(error as Error).message}`);
    }
  }

  async function measure() {
    if (!deviceId) return;
    setMeasuring(true);
    setMessage("Calibration計測中: OutputとInputをループバック接続してください");
    try {
      const latency = await engine.current.measureLatency(deviceId);
      if (!Number.isFinite(latency)) throw new Error("クリックを検出できませんでした");
      setSampleRate(engine.current.sampleRate);
      const created = await api.createCalibration({ input_device_id: deviceId, output_device_id: "default", sample_rate_hz: engine.current.sampleRate, browser_info: navigator.userAgent, roundtrip_latency_ms: Number(latency.toFixed(2)), calibration_method: "cable_loopback" });
      setCalibrations((items) => [created, ...items]);
      setCalibrationId(created.id);
      setMessage(`Round Trip Latency ${created.roundtrip_latency_ms.toFixed(1)} ms`);
    } catch (error) {
      setMessage(`Calibrationに失敗しました: ${(error as Error).message}`);
    } finally {
      setMeasuring(false);
    }
  }

  return <>
    <PageHeader eyebrow="Practice" title="練習・録音" description="Bass Muteをローカル再生して演奏を録音" actions={<button className="button" onClick={() => setCalibrationOpen(!calibrationOpen)}><Gauge />Latency Calibration</button>} />
    <ViewStatePanel state={state}>
      {calibrationOpen && <section className="panel calibration-panel">
        <div><h3>Latency Calibration</h3><p>OutputからInputへループバックして測定</p></div>
        <label>Input<select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>{devices.map((device) => <option value={device.deviceId} key={device.deviceId}>{device.label || "Audio Input"}</option>)}</select></label>
        <label>Sample rate<select disabled><option>{sampleRate} Hz</option></select></label>
        <label>採用値<select value={calibrationId ?? ""} onChange={(event) => setCalibrationId(event.target.value ? Number(event.target.value) : null)}><option value="">未校正</option>{calibrations.map((item) => <option value={item.id} key={item.id}>#{item.id} {item.roundtrip_latency_ms.toFixed(1)} ms</option>)}</select></label>
        <strong>{calibration ? `${calibration.roundtrip_latency_ms.toFixed(1)} ms` : "-"}</strong>
        <button className="button primary" disabled={!deviceId || measuring} onClick={() => measure()}>{measuring ? "測定中..." : "自動測定"}</button>
      </section>}
      <div className="content-grid practice-grid">
        <section className="panel">
          <Waveform buffer={buffer} compact loopStart={useRange ? section.start : null} loopEnd={useRange ? section.end : null} />
          <div className="practice-controls">
            <label>伴奏<select value={accompaniment} onChange={(event) => setAccompaniment(event.target.value)}>{ACCOMPANIMENT.map((item) => <option key={item.value} value={item.value} disabled={!summary.assets[item.value]}>{item.label}</option>)}</select></label>
            <label>速度<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{SPEEDS.map((value) => <option key={value} value={value}>{value * 100}%</option>)}</select></label>
            <label className="toggle"><input type="checkbox" checked={useRange} onChange={(event) => setUseRange(event.target.checked)} /><span />A-B区間</label>
            <label>A<input type="number" min={0} step={0.1} disabled={!useRange} value={range.start} onChange={(event) => setRange({ ...range, start: Number(event.target.value) })} /></label>
            <label>B<input type="number" min={0} step={0.1} disabled={!useRange} value={range.end} onChange={(event) => setRange({ ...range, end: Number(event.target.value) })} /></label>
          </div>
          <div className="preload"><Radio /><div><strong>{preloading ? "伴奏をロード中..." : message}</strong><small>Direct Monitorを使用してください</small></div></div>
          <section className="device-card">
            <SlidersHorizontal />
            <div><small>Audio Input</small><select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>{devices.map((device) => <option value={device.deviceId} key={device.deviceId}>{device.label || "Audio Input"}</option>)}</select></div>
            <div><small>Count-in</small><select value={countInBars} onChange={(event) => setCountInBars(Number(event.target.value))}>{COUNT_IN_BARS.map((bars) => <option key={bars} value={bars}>{bars} bars</option>)}</select></div>
          </section>
        </section>
        <aside className="panel record-panel">
          <div className="panel-title"><h3>Recording</h3><span className={recording ? "live" : ""}>{recording ? "REC" : ready ? "READY" : "LOADING"}</span></div>
          <div className="input-meter"><i style={{ width: `${Math.min(100, level * 300)}%` }} /></div>
          <button disabled={!ready} className={`record-button ${recording ? "recording" : ""}`} onClick={() => toggleRecording().catch((error) => setMessage(error.message))}><Mic2 /><span>{recording ? "STOP" : "REC"}</span></button>
          <strong className="record-time">{formatClock(elapsed)}</strong>
          {pending && <button className="button primary" onClick={() => retryUpload()}><Upload />録音を再送</button>}
          <dl className="facts">
            <dt>Calibration</dt><dd>{calibration ? `${calibration.roundtrip_latency_ms.toFixed(1)} ms` : "未校正"}</dd>
            <dt>Section</dt><dd>{section.start.toFixed(1)} - {section.end.toFixed(1)} s</dd>
            <dt>Monitor</dt><dd>Direct Monitor</dd>
          </dl>
        </aside>
      </div>
    </ViewStatePanel>
  </>;
}
