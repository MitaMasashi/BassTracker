import { clickWaveform, roundtripLatencyMs } from "./calibration";
import { stretchAudioBuffer } from "./stretchAudioBuffer";
import { countInDuration } from "./timeline";
import { encodeWav } from "./wav";

const INPUT_CONSTRAINTS = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
const DOWNBEAT_HZ = 1200;
const BEAT_HZ = 800;
const CALIBRATION_HZ = 1000;

export interface PracticeStartOptions {
  deviceId: string;
  /** 再生する伴奏。prepare() 済みなら bufferSpeed 倍速へピッチ維持で変換済み。 */
  buffer: AudioBuffer | null;
  /** buffer が既に時間伸縮されている倍率 (原音のままなら1)。 */
  bufferSpeed?: number;
  sectionStartSeconds: number;
  sectionEndSeconds: number;
  playbackSpeed: number;
  countInBars: number;
  bpm: number;
  beatsPerBar: number;
}

interface Capture {
  chunks: Float32Array[];
  node: AudioWorkletNode;
  stream: MediaStream;
  startedAt: number;
}

export function dropSamples(chunks: Float32Array[], count: number): Float32Array[] {
  let remaining = Math.max(0, count);
  const kept: Float32Array[] = [];
  for (const chunk of chunks) {
    if (remaining >= chunk.length) {
      remaining -= chunk.length;
      continue;
    }
    kept.push(remaining ? chunk.subarray(remaining) : chunk);
    remaining = 0;
  }
  return kept;
}

export function concatSamples(chunks: Float32Array[]): Float32Array {
  const merged = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

/**
 * 原音の区間 [sectionStart, sectionEnd] を伸縮済みBuffer上の位置へ変換する。
 * 伸縮済みBufferでは原音時刻 t が t / bufferSpeed に位置する。
 * playbackRate が1でなくなるのは未変換Bufferを渡した場合だけ (ピッチも変わる)。
 */
export function accompanimentPlayback(options: Pick<PracticeStartOptions, "sectionStartSeconds" | "sectionEndSeconds" | "playbackSpeed" | "bufferSpeed">) {
  const bufferSpeed = options.bufferSpeed ?? 1;
  return {
    playbackRate: options.playbackSpeed / bufferSpeed,
    offsetSeconds: options.sectionStartSeconds / bufferSpeed,
    durationSeconds: Math.max(0, options.sectionEndSeconds - options.sectionStartSeconds) / bufferSpeed,
  };
}

export class PracticeAudioEngine {
  private context?: AudioContext;
  private workletReady = false;
  private capture?: Capture;
  private analyser?: AnalyserNode;
  private accompaniment?: AudioBufferSourceNode;
  private anchor = 0;

  get sampleRate(): number {
    return this.context?.sampleRate ?? 48000;
  }

  private ensureContext(): AudioContext {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext();
      this.workletReady = false;
    }
    return this.context;
  }

  private async ensureWorklet(context: AudioContext): Promise<void> {
    if (this.workletReady) return;
    await context.audioWorklet.addModule("/pcm-recorder-worklet.js");
    this.workletReady = true;
  }

  async devices(): Promise<MediaDeviceInfo[]> {
    const granted = await navigator.mediaDevices.getUserMedia({ audio: true });
    granted.getTracks().forEach((track) => track.stop());
    return (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
  }

  async load(url: string): Promise<AudioBuffer> {
    const context = this.ensureContext();
    const encoded = await fetch(url).then((response) => response.arrayBuffer());
    return context.decodeAudioData(encoded);
  }

  /** 伴奏をピッチ維持のまま speed 倍速へ事前変換する。練習中に計算しないためREC前に呼ぶ。 */
  prepare(buffer: AudioBuffer, speed: number): Promise<AudioBuffer> {
    return stretchAudioBuffer(this.ensureContext(), buffer, speed);
  }

  private async openCapture(deviceId: string): Promise<Capture> {
    const context = this.ensureContext();
    await context.resume();
    await this.ensureWorklet(context);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId }, ...INPUT_CONSTRAINTS } });
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, "pcm-recorder");
    const chunks: Float32Array[] = [];
    node.port.onmessage = (event: MessageEvent<Float32Array>) => chunks.push(event.data);
    const silence = context.createGain();
    silence.gain.value = 0; // 自分の音はAudio I/FのDirect Monitorで聴くため、ブラウザからは出力しない
    source.connect(node);
    node.connect(silence).connect(context.destination);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);
    return { chunks, node, stream, startedAt: context.currentTime };
  }

  private closeCapture(capture: Capture): void {
    capture.node.port.onmessage = null;
    capture.node.disconnect();
    capture.stream.getTracks().forEach((track) => track.stop());
  }

  private scheduleClick(context: AudioContext, when: number, frequency: number): void {
    const wave = clickWaveform(context.sampleRate, frequency);
    const buffer = context.createBuffer(1, wave.length, context.sampleRate);
    buffer.copyToChannel(wave, 0);
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.connect(context.destination);
    node.start(when);
  }

  inputLevel(): number {
    if (!this.analyser) return 0;
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    let total = 0;
    for (const sample of samples) total += sample * sample;
    return Math.sqrt(total / samples.length);
  }

  /** Count-inと伴奏を同一AudioContext Clockでscheduleし、count-in開始秒数を返す。 */
  async start(options: PracticeStartOptions): Promise<number> {
    const context = this.ensureContext();
    this.capture = await this.openCapture(options.deviceId);
    const beats = Math.max(0, Math.round(options.countInBars * options.beatsPerBar));
    const countIn = beats ? countInDuration(options.bpm, options.playbackSpeed, options.countInBars, options.beatsPerBar) : 0;
    const begin = context.currentTime + 0.15;
    for (let index = 0; index < beats; index++) {
      this.scheduleClick(context, begin + (countIn / beats) * index, index % options.beatsPerBar === 0 ? DOWNBEAT_HZ : BEAT_HZ);
    }
    if (options.buffer) {
      const node = context.createBufferSource();
      const playback = accompanimentPlayback(options);
      node.buffer = options.buffer;
      node.playbackRate.value = playback.playbackRate;
      node.connect(context.destination);
      node.start(begin + countIn, playback.offsetSeconds, playback.durationSeconds);
      this.accompaniment = node;
    }
    this.anchor = begin;
    return countIn;
  }

  /** 録音の先頭をcount-in開始へ揃える。解析側は録音時刻0をcount-in開始として扱う。 */
  async stop(): Promise<{ blob: Blob; sampleRate: number }> {
    const capture = this.capture;
    const rate = this.sampleRate;
    try {
      this.accompaniment?.stop();
    } catch {
      // 既に再生が終了している場合は何もしない
    }
    this.accompaniment = undefined;
    if (!capture) return { blob: encodeWav([], rate), sampleRate: rate };
    this.closeCapture(capture);
    this.capture = undefined;
    const skip = Math.round((this.anchor - capture.startedAt) * rate);
    return { blob: encodeWav(dropSamples(capture.chunks, skip), rate), sampleRate: rate };
  }

  async measureLatency(deviceId: string, clicks = 5, intervalMs = 500): Promise<number> {
    const context = this.ensureContext();
    const capture = await this.openCapture(deviceId);
    const begin = context.currentTime + 0.2;
    const scheduled = Array.from({ length: clicks }, (_, index) => (index * intervalMs) / 1000);
    for (const offset of scheduled) this.scheduleClick(context, begin + offset, CALIBRATION_HZ);
    const waitMs = (begin - context.currentTime + scheduled[scheduled.length - 1] + 0.6) * 1000;
    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
    this.closeCapture(capture);
    this.capture = undefined;
    const rate = context.sampleRate;
    const recorded = concatSamples(dropSamples(capture.chunks, Math.round((begin - capture.startedAt) * rate)));
    return roundtripLatencyMs(recorded, clickWaveform(rate, CALIBRATION_HZ), rate, scheduled);
  }
}