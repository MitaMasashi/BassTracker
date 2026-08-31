const STORAGE_KEY = "bass-practice-lab.selected-track";

export function readSelectedTrack(): number | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function writeSelectedTrack(trackId: number): void {
  window.localStorage.setItem(STORAGE_KEY, String(trackId));
}
