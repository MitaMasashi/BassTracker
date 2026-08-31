import { describe, expect, it } from "vitest";
import { clickLatencies, clickWaveform, estimateLatency, median, roundtripLatencyMs } from "../services/calibration";

const SAMPLE_RATE = 48000;

function delayedClick(click: Float32Array, delaySamples: number, totalSamples: number, amplitude = 0.8): Float32Array {
  const recorded = new Float32Array(totalSamples);
  for (let index = 0; index < click.length && delaySamples + index < totalSamples; index++) {
    recorded[delaySamples + index] = click[index] * amplitude;
  }
  return recorded;
}

describe("clickWaveform", () => {
  it("produces a windowed burst of the requested length", () => {
    const wave = clickWaveform(SAMPLE_RATE, 1000, 6);
    expect(wave.length).toBe(288);
    expect(Math.max(...wave)).toBeGreaterThan(0.5);
    expect(wave[0]).toBeCloseTo(0, 5);
  });
});

describe("estimateLatency", () => {
  it("recovers a known delay of 1280 samples at 48kHz", () => {
    const click = clickWaveform(SAMPLE_RATE);
    const recorded = delayedClick(click, 1280, SAMPLE_RATE);
    expect(estimateLatency(click, recorded, SAMPLE_RATE)).toBeCloseTo(26.667, 2);
  });

  it("is unaffected by a louder late transient", () => {
    const click = clickWaveform(SAMPLE_RATE);
    const recorded = delayedClick(click, 960, SAMPLE_RATE, 0.2);
    for (let index = 20000; index < 20400; index++) recorded[index] = 0.95;
    expect(estimateLatency(click, recorded, SAMPLE_RATE)).toBeCloseTo(20, 1);
  });
});

describe("median", () => {
  it("returns the middle value for odd counts", () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it("averages the two middle values for even counts", () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it("returns NaN when empty", () => {
    expect(Number.isNaN(median([]))).toBe(true);
  });
});

describe("roundtripLatencyMs", () => {
  it("drops the first click and reports the median of the rest", () => {
    const click = clickWaveform(SAMPLE_RATE);
    const scheduled = [0, 0.5, 1, 1.5, 2];
    const recorded = new Float32Array(SAMPLE_RATE * 3);
    const delaysMs = [80, 26, 27, 26, 27];
    scheduled.forEach((offset, index) => {
      const begin = Math.round((offset + delaysMs[index] / 1000) * SAMPLE_RATE);
      for (let sample = 0; sample < click.length; sample++) recorded[begin + sample] = click[sample] * 0.7;
    });
    const perClick = clickLatencies(recorded, click, SAMPLE_RATE, scheduled);
    expect(perClick[0]).toBeCloseTo(80, 0);
    expect(roundtripLatencyMs(recorded, click, SAMPLE_RATE, scheduled)).toBeCloseTo(26.5, 0);
  });
});
