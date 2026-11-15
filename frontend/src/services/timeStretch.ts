/**
 * WSOLA (Waveform Similarity Overlap-Add) によるピッチ維持の時間伸縮。
 *
 * 出力時刻 t' と入力時刻 t の関係は t' ≈ t / speed を保つ。各フレームの入力位置は
 * 理想位置から最大 toleranceSeconds しかずれないため、演奏解析側の
 * reference_recording_time (count_in + (t - section_start) / speed) との整合が保たれる。
 */
export interface TimeStretchOptions {
  /** 合成フレーム長。ベース低音の周期 (Low-B ≈ 32ms) を複数含む長さにする。 */
  windowSeconds?: number;
  /** 波形の連続性を探索する範囲 (理想位置からの最大ずれ)。 */
  toleranceSeconds?: number;
  /** 粗探索時の間引き率。 */
  decimation?: number;
}

// toleranceは5弦Low-B (30.87 Hz, 周期32.4ms) の1周期を±で覆える値にする。
// これより狭いと位相の合う位置が探索範囲に無く、低音のPitchが崩れる。
const DEFAULTS: Required<TimeStretchOptions> = { windowSeconds: 0.06, toleranceSeconds: 0.017, decimation: 4 };

export function stretchedLength(inputLength: number, speed: number): number {
  return Math.round(inputLength / speed);
}

function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const mono = new Float32Array(channels[0].length);
  for (const channel of channels) for (let index = 0; index < mono.length; index++) mono[index] += channel[index];
  const scale = 1 / channels.length;
  for (let index = 0; index < mono.length; index++) mono[index] *= scale;
  return mono;
}

function similarity(mono: Float32Array, target: number, candidate: number, length: number, sampleStep: number): number {
  let dot = 0;
  let energy = 0;
  for (let index = 0; index < length; index += sampleStep) {
    const value = mono[candidate + index];
    dot += value * mono[target + index];
    energy += value * value;
  }
  return energy > 0 ? dot / Math.sqrt(energy) : 0;
}

/** 類似度が最大となる candidate 開始位置を [low, high] から探す。 */
function bestOffset(mono: Float32Array, target: number, low: number, high: number, length: number, step: number, sampleStep: number): number {
  let best = low;
  let bestScore = -Infinity;
  for (let candidate = low; candidate <= high; candidate += step) {
    const score = similarity(mono, target, candidate, length, sampleStep);
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  return best;
}

/**
 * 粗探索: 類似度が最大値の ACCEPT_RATIO 以上の候補のうち、理想位置に最も近いものを選ぶ。
 * 単純な最大値だと自然な続き側 (探索範囲の端) に偏り、アタックが系統的に早まる。
 * 周期信号では類似度の山が1周期ごとに並ぶため、理想位置に近い山を選べば平均ずれは0に近づく。
 */
const ACCEPT_RATIO = 0.9;
function balancedOffset(mono: Float32Array, target: number, ideal: number, low: number, high: number, length: number, step: number): number {
  const candidates: number[] = [];
  const scores: number[] = [];
  for (let candidate = low; candidate <= high; candidate += step) {
    candidates.push(candidate);
    scores.push(similarity(mono, target, candidate, length, step));
  }
  const maximum = Math.max(...scores);
  if (!(maximum > 0)) return Math.min(high, Math.max(low, ideal));
  let chosen = candidates[scores.indexOf(maximum)];
  let distance = Infinity;
  scores.forEach((score, index) => {
    // 山の頂上 (局所最大) だけを候補にする。低音では山の裾野も ACCEPT_RATIO を超えるため、
    // 裾野を選ぶと位相がずれてPitchが下がる。
    const isPeak = index > 0 && index < scores.length - 1 && score >= scores[index - 1] && score >= scores[index + 1];
    if (!isPeak || score < maximum * ACCEPT_RATIO) return;
    const gap = Math.abs(candidates[index] - ideal);
    if (gap < distance) { distance = gap; chosen = candidates[index]; }
  });
  return chosen;
}

/**
 * 全Channelに同じフレーム位置を適用して伸縮する (Stereo像を崩さない)。
 * speed < 1 で遅く (長く)、speed > 1 で速く (短く) なる。
 */
export function timeStretch(channels: Float32Array[], sampleRate: number, speed: number, options: TimeStretchOptions = {}): Float32Array[] {
  if (!channels.length) return [];
  if (!(speed > 0) || !Number.isFinite(speed)) throw new Error(`Invalid playback speed: ${speed}`);
  if (speed === 1) return channels.map((channel) => channel.slice());
  const { windowSeconds, toleranceSeconds, decimation } = { ...DEFAULTS, ...options };
  const inputLength = channels[0].length;
  const outputLength = stretchedLength(inputLength, speed);
  const frame = Math.max(64, 2 * Math.round((windowSeconds * sampleRate) / 2));
  const synthesisHop = frame / 2;
  const analysisHop = synthesisHop * speed;
  const tolerance = Math.max(1, Math.round(toleranceSeconds * sampleRate));
  const outputs = channels.map(() => new Float32Array(outputLength + frame));
  const weights = new Float32Array(outputLength + frame);
  if (inputLength < frame) {
    // フレームより短い入力は伸縮できないため、無音で長さだけ合わせて原音を置く
    outputs.forEach((output, channel) => output.set(channels[channel].subarray(0, Math.min(inputLength, outputLength))));
    return outputs.map((output) => output.slice(0, outputLength));
  }

  // 周期Hann窓は50%オーバーラップで和が1になる
  const window = new Float32Array(frame);
  for (let index = 0; index < frame; index++) window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / frame);

  const mono = mixToMono(channels);
  const lastStart = inputLength - frame;
  const overlap = synthesisHop;
  let previousStart = 0;
  const frames = Math.ceil(outputLength / synthesisHop) + 1;
  for (let k = 0; k < frames; k++) {
    const outputStart = k * synthesisHop;
    if (outputStart >= outputLength) break;
    // フレーム中心 (窓の重みが最大) を t' = t / speed に合わせる。先頭基準にすると
    // 窓内でのアタック位置に応じて最大 frame * (1/speed - 1) 早く聞こえる。
    const ideal = Math.max(0, Math.min(lastStart, Math.round((outputStart + frame / 2) * speed - frame / 2)));
    let start = ideal;
    if (k > 0) {
      // 前フレームの自然な続き (previousStart + synthesisHop) に最も似た位置を選ぶ
      const natural = Math.min(lastStart, previousStart + synthesisHop);
      const low = Math.max(0, ideal - tolerance);
      const high = Math.min(lastStart, ideal + tolerance);
      const coarse = balancedOffset(mono, natural, ideal, low, high, overlap, decimation);
      start = bestOffset(mono, natural, Math.max(low, coarse - decimation), Math.min(high, coarse + decimation), overlap, 1, 2);
    }
    for (let channel = 0; channel < channels.length; channel++) {
      const input = channels[channel];
      const output = outputs[channel];
      for (let index = 0; index < frame; index++) output[outputStart + index] += window[index] * input[start + index];
    }
    for (let index = 0; index < frame; index++) weights[outputStart + index] += window[index];
    previousStart = start;
  }

  return outputs.map((output) => {
    const result = output.slice(0, outputLength);
    for (let index = 0; index < outputLength; index++) if (weights[index] > 1e-3) result[index] /= weights[index];
    return result;
  });
}
