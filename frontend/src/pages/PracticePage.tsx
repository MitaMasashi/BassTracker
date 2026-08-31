import { Gauge, Mic2, Radio, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { WaveformMock } from "../components/audio/WaveformMock";
import { useViewState } from "../components/layout/AppLayout";
import { calibration } from "../mocks/mockData";

export function PracticePage() {
  const state = useViewState(); const [calibrationOpen, setCalibrationOpen] = useState(false); const [recording, setRecording] = useState(false);
  return <><PageHeader eyebrow="Practice" title="練習・録音" description="Bass Muteをローカル再生して演奏を録音" actions={<button className="button" onClick={() => setCalibrationOpen(!calibrationOpen)}><Gauge />Latency Calibration</button>} /><ViewStatePanel state={state}>
    {calibrationOpen && <section className="panel calibration-panel"><div><h3>Latency Calibration</h3><p>OutputからInputへループバックして測定</p></div><label>Input<select><option>Focusrite USB Input 1</option></select></label><label>Output<select><option>Focusrite USB Output</option></select></label><label>Sample rate<select><option>48000 Hz</option></select></label><button className="button primary">自動測定</button><strong>{calibration.roundtripLatencyMs} ms</strong></section>}
    <div className="content-grid practice-grid"><section className="panel"><WaveformMock compact /><div className="practice-controls"><label>伴奏<select><option>Bass Mute</option><option>Source</option></select></label><label>速度<select><option>75%</option><option>90%</option><option>100%</option></select></label><label className="toggle"><input type="checkbox" defaultChecked /><span />A-B区間</label></div><div className="preload"><Radio /><div><strong>再生準備完了</strong><small>Assetをローカルへロード済み</small></div></div><section className="device-card"><SlidersHorizontal /><div><small>Audio Input</small><select><option>Focusrite USB / Channel 1</option></select></div><div><small>Count-in</small><select><option>2 bars</option><option>1 bar</option></select></div></section></section>
    <aside className="panel record-panel"><div className="panel-title"><h3>Recording</h3><span className={recording ? "live" : ""}>{recording ? "REC" : "READY"}</span></div><div className="input-meter"><i /></div><button className={`record-button ${recording ? "recording" : ""}`} onClick={() => setRecording(!recording)}><Mic2 /><span>{recording ? "STOP" : "REC"}</span></button><strong className="record-time">{recording ? "00:04.8" : "00:00.0"}</strong><dl className="facts"><dt>Calibration</dt><dd>{calibration.roundtripLatencyMs} ms</dd><dt>Monitor</dt><dd>Direct Monitor</dd></dl></aside></div>
  </ViewStatePanel></>;
}