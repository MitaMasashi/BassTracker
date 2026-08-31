import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "../components/layout/AppLayout";
import { LibraryPage } from "./LibraryPage";
import { api } from "../api/client";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, api: { tracks: vi.fn(), jobs: vi.fn(), retryJob: vi.fn() } };
});

const mocked = vi.mocked(api, true);
const track = { id: 7, display_title: "Sample Song", song_title: "Sample", artist_name: "Artist A", duration_seconds: 200, bpm: 118, musical_key: "E minor", status: "ready" };
const other = { ...track, id: 8, display_title: "Second Song" };

function renderLibrary() {
  return render(
    <MemoryRouter initialEntries={["/tracks"]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/tracks" element={<LibraryPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocked.jobs.mockResolvedValue([]);
});

describe("sidebar track links", () => {
  it("follows the selected track without a page reload", async () => {
    mocked.tracks.mockResolvedValue({ items: [track, other], total: 2 });
    renderLibrary();
    await waitFor(() => expect(screen.getByRole("link", { name: "耳コピ" })).toHaveAttribute("href", "/tracks/7/ear-copy"));
    await userEvent.click(screen.getByRole("button", { name: /Second Song/ }));
    await waitFor(() => expect(screen.getByRole("link", { name: "練習・録音" })).toHaveAttribute("href", "/tracks/8/practice"));
  });

  it("restores the previously selected track on mount", async () => {
    window.localStorage.setItem("bass-practice-lab.selected-track", "8");
    mocked.tracks.mockReturnValue(new Promise(() => undefined));
    renderLibrary();
    expect(screen.getByRole("link", { name: "耳コピ" })).toHaveAttribute("href", "/tracks/8/ear-copy");
  });
});
