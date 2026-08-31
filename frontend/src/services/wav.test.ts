import { describe, expect, it } from "vitest";
import { encodeWav } from "../services/wav";
import { concatSamples, dropSamples } from "../services/practiceAudioEngine";

async function header(blob: Blob) {
  return new DataView(await blob.arrayBuffer());
}

function text(view: DataView, offset: number, length: number): string {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join("");
}

describe("encodeWav", () => {
  it("writes a mono 16-bit PCM header", async () => {
    const view = await header(encodeWav([new Float32Array([0, 0.5, -0.5, 1])], 48000));
    expect(text(view, 0, 4)).toBe("RIFF");
    expect(text(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(28, true)).toBe(96000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
  });

  it("clamps samples outside the unit range", async () => {
    const view = await header(encodeWav([new Float32Array([2, -2])], 48000));
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32767);
  });
});

describe("dropSamples", () => {
  it("removes leading samples across chunk boundaries", () => {
    const chunks = [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])];
    expect(Array.from(concatSamples(dropSamples(chunks, 4)))).toEqual([5, 6]);
  });

  it("keeps everything when nothing to drop", () => {
    const chunks = [new Float32Array([1, 2])];
    expect(Array.from(concatSamples(dropSamples(chunks, 0)))).toEqual([1, 2]);
  });

  it("returns empty when dropping past the end", () => {
    expect(concatSamples(dropSamples([new Float32Array([1, 2])], 9)).length).toBe(0);
  });
});
