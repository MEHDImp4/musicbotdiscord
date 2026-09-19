export interface LrcLine {
  timeMs: number;
  text: string;
}

const TIME_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Parses LRC-formatted lyrics into time-sorted lines. Lines without a
 * timestamp (metadata like [ar:…]) are ignored. Pure and testable.
 */
export function parseLrc(text: string): LrcLine[] {
  const lines: LrcLine[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const matches = [...raw.matchAll(TIME_TAG)];
    if (matches.length === 0) continue;

    const content = raw.replace(TIME_TAG, "").trim();
    if (!content) continue;

    for (const match of matches) {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const fraction = match[3] ? Number.parseInt(match[3].padEnd(3, "0"), 10) : 0;
      lines.push({ timeMs: (minutes * 60 + seconds) * 1000 + fraction, text: content });
    }
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

/** Index of the last line whose timestamp is at or before `positionMs`, or -1. */
export function findActiveLineIndex(lines: readonly LrcLine[], positionMs: number): number {
  let low = 0;
  let high = lines.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}
