import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "../components/layout/AppLayout";
import { ViewStatePanel } from "../components/common/ViewStatePanel";
import { LibraryPage } from "./LibraryPage";
import { HistoryPage } from "./HistoryPage";
import { api } from "../api/client";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, api: { tracks: vi.fn(), jobs: vi.fn(), retryJob: vi.fn(), history: vi.fn(), patchTrack: vi.fn() } };
});

const mocked = vi.mocked(api, true);

const track = { id: 7, display_title: "Sample Song", song_title: "Sample", artist_name: "Artist A", duration_seconds: 200, bpm: 118, musical_key: "E minor", status: "ready" };
const partial = { ...track, id: 8, display_title: "Partial Song", status: "partial", bpm: null, musical_key: null };

function renderWithLayout(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/tracks" element={<LibraryPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("ViewStatePanel", () => {
  it.each([
    ["loading", "読み込み中"],
    ["empty", "データがありません"],
    ["error", "読み込めませんでした"],
  ] as const)("renders the %s state", (state, title) => {
    render(<ViewStatePanel state={state}><p>content</p></ViewStatePanel>);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("renders children when normal", () => {
    render(<ViewStatePanel state="normal"><p>content</p></ViewStatePanel>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});

describe("LibraryPage", () => {
  it("shows the loading state before the request resolves", () => {
    mocked.tracks.mockReturnValue(new Promise(() => undefined));
    renderWithLayout("/tracks");
    expect(screen.getByText("読み込み中")).toBeInTheDocument();
  });

  it("shows the empty state when no track exists", async () => {
    mocked.tracks.mockResolvedValue({ items: [], total: 0 });
    renderWithLayout("/tracks");
    expect(await screen.findByText("データがありません")).toBeInTheDocument();
  });

  it("shows the error state when the API fails", async () => {
    mocked.tracks.mockRejectedValue(new Error("offline"));
    renderWithLayout("/tracks");
    expect(await screen.findByText("読み込めませんでした")).toBeInTheDocument();
  });

  it("switches the detail panel when another track is selected", async () => {
    mocked.tracks.mockResolvedValue({ items: [track, partial], total: 2 });
    mocked.jobs.mockResolvedValue([]);
    renderWithLayout("/tracks");
    expect(await screen.findByText("Artist A")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Partial Song/ }));
    await waitFor(() => expect(screen.getByRole("link", { name: "耳コピを開く" })).toHaveAttribute("href", "/tracks/8/ear-copy"));
  });

  it("offers a retry action only for failed jobs", async () => {
    mocked.tracks.mockResolvedValue({ items: [track], total: 1 });
    mocked.jobs.mockResolvedValue([
      { id: 1, practice_track_id: 7, job_type: "stem_separation", status: "succeeded", error_message: null },
      { id: 2, practice_track_id: 7, job_type: "pitch_analysis", status: "failed", error_message: "boom" },
    ]);
    renderWithLayout("/tracks");
    await waitFor(() => expect(screen.getAllByTitle("再試行")).toHaveLength(1));
  });

  it("edits track info and shows the saved values", async () => {
    mocked.tracks.mockResolvedValue({ items: [track], total: 1 });
    mocked.jobs.mockResolvedValue([]);
    mocked.patchTrack.mockImplementation(async (_id, body) => ({ ...track, ...body, display_title: body.display_title ?? track.display_title }));
    renderWithLayout("/tracks");
    await userEvent.click(await screen.findByRole("button", { name: /情報を編集/ }));
    const bpm = screen.getByLabelText("BPM");
    await userEvent.clear(bpm);
    await userEvent.type(bpm, "96.5");
    await userEvent.type(screen.getByLabelText("拍子の分子"), "6");
    await userEvent.selectOptions(screen.getByLabelText("拍子の分母"), "8");
    await userEvent.clear(screen.getByLabelText(/曲名/));
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => expect(mocked.patchTrack).toHaveBeenCalledWith(7, { display_title: "Sample Song", song_title: null, artist_name: "Artist A", bpm: 96.5, musical_key: "E minor", time_signature_numerator: 6, time_signature_denominator: 8 }));
    expect(await screen.findByText("曲情報を保存しました")).toBeInTheDocument();
    expect(screen.getByText("6/8")).toBeInTheDocument();
  });

  it("rejects a time signature with only one side filled", async () => {
    mocked.tracks.mockResolvedValue({ items: [track], total: 1 });
    mocked.jobs.mockResolvedValue([]);
    renderWithLayout("/tracks");
    await userEvent.click(await screen.findByRole("button", { name: /情報を編集/ }));
    await userEvent.type(screen.getByLabelText("拍子の分子"), "3");
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));
    expect(await screen.findByText("拍子は分子と分母の両方を指定してください")).toBeInTheDocument();
    expect(mocked.patchTrack).not.toHaveBeenCalled();
  });

  it("points the sidebar at the selected track", async () => {
    mocked.tracks.mockResolvedValue({ items: [track], total: 1 });
    mocked.jobs.mockResolvedValue([]);
    renderWithLayout("/tracks");
    await waitFor(() => expect(window.localStorage.getItem("bass-practice-lab.selected-track")).toBe("7"));
  });

  it("sends the sidebar to the library when no track was selected", () => {
    mocked.tracks.mockResolvedValue({ items: [], total: 0 });
    renderWithLayout("/tracks");
    expect(screen.getByRole("link", { name: "耳コピ" })).toHaveAttribute("href", "/tracks");
  });
});

describe("HistoryPage", () => {
  it("renders one row per recording session", async () => {
    mocked.history.mockResolvedValue([
      { recording_session_id: 2, recorded_at: "2026-08-31T10:00:00Z", practice_track_id: 7, practice_track: "Sample Song", section_start_seconds: 80, section_end_seconds: 92, playback_speed: 1, result_id: null, timing_mean_ms: null, timing_mae_ms: null, timing_std_ms: null, level_std_db: null, matched_note_count: null, missing_note_count: null, extra_note_count: null },
      { recording_session_id: 1, recorded_at: "2026-08-30T10:00:00Z", practice_track_id: 7, practice_track: "Sample Song", section_start_seconds: 80, section_end_seconds: 92, playback_speed: 0.9, result_id: 3, timing_mean_ms: 5, timing_mae_ms: 24.1, timing_std_ms: 17.2, level_std_db: 2.1, matched_note_count: 121, missing_note_count: 7, extra_note_count: 4 },
    ]);
    renderWithLayout("/history");
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
    expect(screen.getAllByRole("link", { name: "詳細" }).some((link) => link.getAttribute("href") === "/analysis?session_id=1&result_id=3")).toBe(true);
    const firstMetricBars = document.querySelectorAll(".trend-row:first-child .trend-bars > span");
    expect(firstMetricBars[0]).toHaveAttribute("title", expect.stringContaining("90%"));
  });

  it("sends selected track and section filters to the history API", async () => {
    mocked.history.mockResolvedValue([
      { recording_session_id: 1, recorded_at: "2026-08-30T10:00:00Z", practice_track_id: 7, practice_track: "Sample Song", section_start_seconds: 80, section_end_seconds: 92, playback_speed: 0.9, result_id: 3, timing_mean_ms: 5, timing_mae_ms: 24.1, timing_std_ms: 17.2, level_std_db: 2.1, matched_note_count: 121, missing_note_count: 7, extra_note_count: 4 },
    ]);
    renderWithLayout("/history");
    await screen.findByRole("option", { name: "Sample Song" });
    await userEvent.selectOptions(screen.getByLabelText("PracticeTrack"), "7");
    await userEvent.type(screen.getByLabelText("Section A"), "80");
    await waitFor(() => expect(mocked.history).toHaveBeenLastCalledWith(expect.objectContaining({ practice_track_id: 7, section_start_seconds: 80 })));
  });
});
