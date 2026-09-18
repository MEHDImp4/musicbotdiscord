export function computeSkipThreshold(
  humanListeners: number,
  minVotes: number,
  ratio: number,
): number {
  const required = Math.ceil(Math.max(0, humanListeners) * ratio);
  return Math.max(minVotes, required);
}
