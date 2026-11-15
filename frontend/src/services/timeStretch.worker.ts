import { timeStretch } from "./timeStretch";

export interface TimeStretchRequest { channels: Float32Array[]; sampleRate: number; speed: number }
export type TimeStretchResponse = { channels: Float32Array[] } | { error: string };

self.onmessage = (event: MessageEvent<TimeStretchRequest>) => {
  try {
    const channels = timeStretch(event.data.channels, event.data.sampleRate, event.data.speed);
    const response: TimeStretchResponse = { channels };
    self.postMessage(response, { transfer: channels.map((channel) => channel.buffer as ArrayBuffer) });
  } catch (error) {
    const response: TimeStretchResponse = { error: error instanceof Error ? error.message : String(error) };
    self.postMessage(response);
  }
};
