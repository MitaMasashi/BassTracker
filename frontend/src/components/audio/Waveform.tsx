import { useEffect, useRef } from "react";
import type { ApiChord, ApiPitch } from "../../api/client";

interface WaveformProps {
  buffer: AudioBuffer | null;
  compact?: boolean;
  currentTime?: number;
  loopStart?: number | null;
  loopEnd?: number | null;
  chords?: ApiChord[];
  pitches?: ApiPitch[];
  activePitchId?: number | null;
  onSeek?: (seconds: number) => void;
  onSelectPitch?: (pitch: ApiPitch) => void;
}

const VISIBLE_EVENTS = 8;

/** 長い曲でも読めるよう、再生位置周辺のイベントだけを描画する (仕様11.13)。 */
function window_<T>(events: T[], activeIndex: number): T[] {
  if (events.length <= VISIBLE_EVENTS) return events;
  const start = Math.min(Math.max(0, activeIndex - Math.floor(VISIBLE_EVENTS / 2)), events.length - VISIBLE_EVENTS);
  return events.slice(start, start + VISIBLE_EVENTS);
}

function drawPeaks(canvas: HTMLCanvasElement, buffer: AudioBuffer): void {
  const context = canvas.getContext("2d");
  const width = Math.max(1, Math.floor(canvas.clientWidth));
  const height = Math.max(1, Math.floor(canvas.clientHeight));
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / width));
  context.fillStyle = "#2c604c";
  for (let x = 0; x < width; x++) {
    let min = 1;
    let max = -1;
    for (let index = 0; index < step; index++) {
      const sample = data[x * step + index] ?? 0;
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    const top = ((1 - max) / 2) * height;
    const bottom = ((1 - min) / 2) * height;
    context.fillRect(x, top, 1, Math.max(1, bottom - top));
  }
}

export function Waveform({ buffer, compact = false, currentTime = 0, loopStart = null, loopEnd = null, chords = [], pitches = [], activePitchId = null, onSeek, onSelectPitch }: WaveformProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const duration = buffer?.duration ?? 0;

  useEffect(() => {
    const element = canvas.current;
    if (!element || !buffer) return;
    const redraw = () => drawPeaks(element, buffer);
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [buffer]);

  const percent = (seconds: number) => (duration ? Math.min(100, Math.max(0, (seconds / duration) * 100)) : 0);
  const looped = loopStart !== null && loopEnd !== null && loopEnd > loopStart;
  const activeChordIndex = Math.max(0, chords.findIndex((chord) => currentTime >= chord.start_seconds && currentTime < chord.end_seconds));
  const visibleChords = window_(chords, activeChordIndex);
  const visiblePitches = window_(pitches, Math.max(0, pitches.findIndex((pitch) => pitch.onset_seconds >= currentTime)));

  return <div className={`wave-panel ${compact ? "compact" : ""}`}>
    {visibleChords.length > 0 && <div className="timeline flow">
      {visibleChords.map((chord) => <span key={chord.id} className={currentTime >= chord.start_seconds && currentTime < chord.end_seconds ? "active" : ""} style={{ flexGrow: Math.max(0.01, chord.end_seconds - chord.start_seconds) }}>{chord.selected_chord}</span>)}
    </div>}
    <div className="waveform real" aria-label="波形" onClick={(event) => {
      if (!onSeek || !duration) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      onSeek(((event.clientX - bounds.left) / bounds.width) * duration);
    }}>
      <canvas ref={canvas} />
      {looped && <span className="loop-range" style={{ left: `${percent(loopStart)}%`, right: `${100 - percent(loopEnd)}%` }} />}
      <span className="playhead" style={{ left: `${percent(currentTime)}%` }} />
    </div>
    {!compact && visiblePitches.length > 0 && <div className="timeline flow pitches">
      {visiblePitches.map((pitch) => <span key={pitch.id} className={pitch.id === activePitchId ? "active" : ""} role="button" onClick={() => onSelectPitch?.(pitch)}>{pitch.selected_pitch ?? "-"}</span>)}
    </div>}
  </div>;
}
