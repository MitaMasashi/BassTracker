import { describe, expect, it } from "vitest";
import { countInDuration, formatClock, referenceRecordingTime } from "../services/timeline";

describe("countInDuration", () => {
  it("matches the backend formula at full speed", () => {
    expect(countInDuration(120, 1, 2, 4)).toBeCloseTo(4);
  });

  it("expands when playback speed is reduced", () => {
    expect(countInDuration(120, 0.5, 2, 4)).toBeCloseTo(8);
  });

  it("shrinks when playback speed is increased", () => {
    expect(countInDuration(120, 1.25, 1, 4)).toBeCloseTo(1.6);
  });

  it("is zero without count-in bars", () => {
    expect(countInDuration(120, 1, 0, 4)).toBe(0);
  });

  it("returns zero for unusable tempo", () => {
    expect(countInDuration(0, 1, 2, 4)).toBe(0);
  });
});

describe("referenceRecordingTime", () => {
  it("maps section-relative time onto the recording timeline", () => {
    expect(referenceRecordingTime(81, 80, 0.5, 8)).toBeCloseTo(10);
  });

  it("keeps the count-in offset at the section start", () => {
    expect(referenceRecordingTime(80, 80, 1, 4)).toBeCloseTo(4);
  });
});

describe("formatClock", () => {
  it("formats minutes and tenths", () => {
    expect(formatClock(84.382)).toBe("01:24.4");
  });

  it("clamps negatives to zero", () => {
    expect(formatClock(-5)).toBe("00:00.0");
  });
});
