const SECONDS_PER_MINUTE = 60;

/** Backend performance_analysis.count_in_duration と同じ式を共有する。 */
export function countInDuration(bpm: number, playbackSpeed: number, bars: number, beatsPerBar: number): number {
  if (bpm <= 0 || playbackSpeed <= 0) return 0;
  return (bars * beatsPerBar * SECONDS_PER_MINUTE) / (bpm * playbackSpeed);
}

export function referenceRecordingTime(originalSeconds: number, sectionStartSeconds: number, playbackSpeed: number, countInSeconds: number): number {
  return countInSeconds + (originalSeconds - sectionStartSeconds) / playbackSpeed;
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${(safe - minutes * 60).toFixed(1).padStart(4, "0")}`;
}
