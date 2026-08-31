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
  return { ...actual, api: { tracks: vi.fn(), jobs: vi.fn(), retryJob: vi.fn(), history: vi.fn() } };
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
      { recording_session_id: 1, recorded_at: "2026-08-30T10:00:00Z", practice_track_id: 7, practice_track: "Sample Song", section_start_seconds: 80, section_end_seconds: 92, playback_speed: 0.9, result_id: 3, timing_mean_ms: 5, timing_mae_ms: 24.1, timing_std_ms: 17.2, level_std_db: 2.1, missing_note_count: 7, extra_note_count: 4 },
      { recording_session_id: 2, recorded_at: "2026-08-31T10:00:00Z", practice_track_id: 7, practice_track: "Sample Song", section_start_seconds: 80, section_end_seconds: 92, playback_speed: 1, result_id: null, timing_mean_ms: null, timing_mae_ms: null, timing_std_ms: null, level_std_db: null, missing_note_count: null, extra_note_count: null },
    ]);
    renderWithLayout("/history");
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
  });
});
