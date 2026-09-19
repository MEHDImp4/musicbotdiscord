import type { Track } from "../music/Track";

/**
 * Picks the first candidate that is neither the seed nor already played.
 * Pure and exported for testing.
 */
export function pickRelatedTrack(
  candidates: readonly Track[],
  seedId: string,
  exclude: ReadonlySet<string>,
): Track | undefined {
  return candidates.find((track) => track.id !== seedId && !exclude.has(track.id));
}
