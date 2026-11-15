import { describe, expect, it } from "vitest";
import { stretchedLength, timeStretch } from "./timeStretch";
import { accompanimentPlayback } from "./practiceAudioEngine";

const RATE = 48000;

function sine(frequency: number, seconds: number, rate = RATE): Float32Array {
  return Float32Array.from({ length: Math.round(seconds * rate) }, (_, index) => 0.5 * Math.sin((2 * Math.PI * frequency * index) / rate));
}

/** 正方向のゼロクロス間隔から基本周波数を推定する。 */
function estimateFrequency(samples: Float32Array, rate = RATE): number {
  const crossings: number[] = [];
  for (let index = 1; index < samples.length; index++) if (samples[index - 1] < 0 && samples[index] >= 0) crossings.push(index);
  return ((crossings.length - 1) * rate) / (crossings[crossings.length - 1] - crossings[0]);
}

function clickTrain(times: number[], seconds: number): Float32Array {
  const samples = new Float32Array(Math.round(seconds * RATE));
  for (const time of times) {
    const start = Math.round(time * RATE);
    for (let index = 0; index < 480; index++) samples[start + index] = Math.sin((2 * Math.PI * 1000 * index) / RATE) * Math.exp(-index / 120);
  }
  return samples;
}

function onsets(samples: Float32Array, threshold = 0.2): number[] {
  const found: number[] = [];
  let last = -Infinity;
  for (let index = 0; index < samples.length; index++) {
    if (Math.abs(samples[index]) >= threshold && index - last > RATE * 0.1) { found.push(index / RATE); last = index; }
  }
  return found;
}

describe("timeStretch", () => {
  it.each([0.75, 0.9, 1.25])("changes the duration by 1/%s while keeping the pitch", (speed) => {
    const [output] = timeStretch([sine(110, 2)], RATE, speed);
    expect(output.length).toBe(stretchedLength(2 * RATE, speed));
    // 端のフェードを除いた定常部で、元の110 Hzが維持されている
    const middle = output.subarray(RATE * 0.2, output.length - RATE * 0.2);
    expect(estimateFrequency(middle)).toBeCloseTo(110, 0);
  });

  it.each([0.75, 0.9])("keeps low-B fundamentals (30.87 Hz) intact at %s", (speed) => {
    const [output] = timeStretch([sine(30.87, 3)], RATE, speed);
    // 0.1 Hz ≈ 6 cent。位相の合わない位置を選ぶと数十centずれる
    expect(Math.abs(estimateFrequency(output.subarray(RATE * 0.3, output.length - RATE * 0.3)) - 30.87)).toBeLessThan(0.1);
  });

  it("maps input time t to output time t / speed within the search tolerance", () => {
    const times = [0.5, 1.0, 1.5, 2.25, 3.0];
    const speed = 0.75;
    const [output] = timeStretch([clickTrain(times, 3.5)], RATE, speed);
    const detected = onsets(output);
    expect(detected).toHaveLength(times.length);
    detected.forEach((time, index) => expect(Math.abs(time - times[index] / speed)).toBeLessThan(0.02));
  });

  it("applies the same frame positions to every channel", () => {
    const left = sine(220, 1);
    const [outLeft, outRight] = timeStretch([left, left.slice()], RATE, 0.9);
    expect(outRight).toEqual(outLeft);
  });

  it("returns an untouched copy at normal speed and rejects invalid speeds", () => {
    const input = sine(110, 0.1);
    const [output] = timeStretch([input], RATE, 1);
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
    expect(() => timeStretch([input], RATE, 0)).toThrow();
  });
});

describe("accompanimentPlayback", () => {
  it("plays a pre-stretched buffer at rate 1 from the scaled section position", () => {
    expect(accompanimentPlayback({ sectionStartSeconds: 80, sectionEndSeconds: 92, playbackSpeed: 0.75, bufferSpeed: 0.75 })).toEqual({ playbackRate: 1, offsetSeconds: 80 / 0.75, durationSeconds: 12 / 0.75 });
  });

  it("falls back to resampling when the buffer was not stretched", () => {
    expect(accompanimentPlayback({ sectionStartSeconds: 10, sectionEndSeconds: 20, playbackSpeed: 0.9 })).toEqual({ playbackRate: 0.9, offsetSeconds: 10, durationSeconds: 10 });
  });
});
