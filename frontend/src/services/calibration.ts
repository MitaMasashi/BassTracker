const DEFAULT_CLICK_MS = 6;

/** Calibration/Count-inで再生し、相互相関の参照にも使う既知クリック波形。 */
export function clickWaveform(sampleRate: number, frequency = 1000, durationMs = DEFAULT_CLICK_MS) {
  const length = Math.max(1, Math.round((durationMs / 1000) * sampleRate));
  const wave = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const envelope = Math.sin((Math.PI * index) / length);
    wave[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * envelope;
  }
  return wave;
}

/** 正規化相互相関でclickがrecorded内で最も一致する位置をms単位で返す。 */
export function estimateLatency(click: Float32Array, recorded: Float32Array, sampleRate: number): number {
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let offset = 0; offset <= recorded.length - click.length; offset++) {
    let dot = 0;
    let energy = 0;
    for (let index = 0; index < click.length; index++) {
      const sample = recorded[offset + index];
      dot += click[index] * sample;
      energy += sample * sample;
    }
    const score = energy > 0 ? dot / Math.sqrt(energy) : 0;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = offset;
    }
  }
  return (bestIndex / sampleRate) * 1000;
}

export function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function clickLatencies(recorded: Float32Array, click: Float32Array, sampleRate: number, scheduledSeconds: number[], searchMs = 300): number[] {
  const span = Math.round((searchMs / 1000) * sampleRate) + click.length;
  const values: number[] = [];
  for (const scheduled of scheduledSeconds) {
    const begin = Math.max(0, Math.round(scheduled * sampleRate));
    const end = Math.min(recorded.length, begin + span);
    if (end - begin < click.length) continue;
    values.push(estimateLatency(click, recorded.subarray(begin, end), sampleRate));
  }
  return values;
}

/** 仕様12.15に従い、立ち上がりの影響を受ける先頭クリックを除いた中央値を採用する。 */
export function roundtripLatencyMs(recorded: Float32Array, click: Float32Array, sampleRate: number, scheduledSeconds: number[], searchMs = 300): number {
  const values = clickLatencies(recorded, click, sampleRate, scheduledSeconds, searchMs);
  return median(values.length > 1 ? values.slice(1) : values);
}