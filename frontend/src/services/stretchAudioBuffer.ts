import { timeStretch } from "./timeStretch";
import type { TimeStretchRequest, TimeStretchResponse } from "./timeStretch.worker";

function runInWorker(request: TimeStretchRequest): Promise<Float32Array[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./timeStretch.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<TimeStretchResponse>) => {
      worker.terminate();
      if ("error" in event.data) reject(new Error(event.data.error));
      else resolve(event.data.channels);
    };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message || "Time stretch worker failed")); };
    worker.postMessage(request, request.channels.map((channel) => channel.buffer as ArrayBuffer));
  });
}

/**
 * 伴奏全体をピッチ維持のまま speed 倍速へ変換した AudioBuffer を返す。
 * 重い処理なのでWorkerで実行し、Workerが無い環境 (テスト等) ではその場で計算する。
 */
export async function stretchAudioBuffer(context: BaseAudioContext, buffer: AudioBuffer, speed: number): Promise<AudioBuffer> {
  if (speed === 1) return buffer;
  // 元のAudioBufferを壊さないようCopyを転送する
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index).slice());
  const request = { channels, sampleRate: buffer.sampleRate, speed };
  const stretched = typeof Worker === "undefined" ? timeStretch(channels, buffer.sampleRate, speed) : await runInWorker(request);
  const output = context.createBuffer(stretched.length, stretched[0]?.length ?? 1, buffer.sampleRate);
  stretched.forEach((channel, index) => output.copyToChannel(channel as Float32Array<ArrayBuffer>, index));
  return output;
}
