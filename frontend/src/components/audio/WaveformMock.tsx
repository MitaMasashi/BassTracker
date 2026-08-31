import { chordEvents, pitchEvents } from "../../mocks/mockData";

export function WaveformMock({ compact = false }: { compact?: boolean }) {
  return <div className={`wave-panel ${compact ? "compact" : ""}`}>
    <div className="timeline chords">{chordEvents.map((event, index) => <span className={index === 2 ? "active" : ""} key={event.id}>{event.selectedChord}</span>)}</div>
    <div className="waveform" aria-label="波形プレースホルダー"><span className="loop-range" /><span className="playhead" /></div>
    {!compact && <div className="timeline pitches">{chordEvents.map((_, index) => <span key={index}>{pitchEvents[index % pitchEvents.length].selectedPitch}</span>)}</div>}
  </div>;
}