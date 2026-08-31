import { encodeWav } from "./wav";

export class PracticeAudioEngine {
  private context?: AudioContext; private stream?: MediaStream; private processor?: AudioWorkletNode; private chunks: Float32Array[] = [];
  async devices() { await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => stream.getTracks().forEach((track) => track.stop())); return (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput"); }
  async start(deviceId: string) {
    this.context = new AudioContext(); await this.context.audioWorklet.addModule("/pcm-recorder-worklet.js"); this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } }); this.chunks = [];
    const source = this.context.createMediaStreamSource(this.stream); this.processor = new AudioWorkletNode(this.context, "pcm-recorder"); this.processor.port.onmessage = (event: MessageEvent<Float32Array>) => this.chunks.push(event.data); source.connect(this.processor); this.processor.connect(this.context.destination);
  }
  async stop() { this.processor?.disconnect(); this.stream?.getTracks().forEach((track) => track.stop()); const rate = this.context?.sampleRate ?? 48000; await this.context?.close(); return { blob: encodeWav(this.chunks, rate), sampleRate: rate }; }
}