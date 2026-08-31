export function estimateLatency(click: Float32Array, recorded: Float32Array, sampleRate: number): number {
  let bestIndex = 0, bestScore = -Infinity;
  for (let offset = 0; offset <= recorded.length - click.length; offset++) { let score = 0; for (let index = 0; index < click.length; index++) score += click[index] * recorded[offset + index]; if (score > bestScore) { bestScore = score; bestIndex = offset; } }
  return bestIndex / sampleRate * 1000;
}