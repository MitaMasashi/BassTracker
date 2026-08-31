import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Waveform } from "./Waveform";
import type { ApiChord } from "../../api/client";

function chord(id: number, start: number): ApiChord {
  return { id, start_seconds: start, end_seconds: start + 2, detected_chord: `C${id}`, selected_chord: `C${id}`, confidence: 0.5, is_user_corrected: false };
}

const chords = Array.from({ length: 20 }, (_, index) => chord(index + 1, index * 2));

describe("Waveform", () => {
  it("renders a windowed chord timeline instead of every event", () => {
    render(<Waveform buffer={null} chords={chords} currentTime={0} />);
    expect(screen.getAllByText(/^C\d+$/)).toHaveLength(8);
  });

  it("highlights the chord under the playhead", () => {
    render(<Waveform buffer={null} chords={chords} currentTime={21} />);
    expect(screen.getByText("C11")).toHaveClass("active");
  });

  it("keeps the window inside the event list at the end of the track", () => {
    render(<Waveform buffer={null} chords={chords} currentTime={39} />);
    expect(screen.getByText("C20")).toBeInTheDocument();
    expect(screen.getAllByText(/^C\d+$/)).toHaveLength(8);
  });

  it("does not render a chord timeline without chords", () => {
    const { container } = render(<Waveform buffer={null} />);
    expect(container.querySelector(".timeline")).toBeNull();
  });

  it("reports the seeked position from a click on the waveform", async () => {
    const onSeek = vi.fn();
    const buffer = { duration: 100, getChannelData: () => new Float32Array(10) } as unknown as AudioBuffer;
    const { container } = render(<Waveform buffer={buffer} onSeek={onSeek} />);
    const surface = container.querySelector(".waveform") as HTMLElement;
    surface.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    await userEvent.pointer({ target: surface, coords: { clientX: 50, clientY: 10 }, keys: "[MouseLeft]" });
    expect(onSeek).toHaveBeenCalledWith(25);
  });
});
