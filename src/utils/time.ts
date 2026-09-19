export function formatDuration(totalSeconds?: number): string {
  if (totalSeconds === undefined || !Number.isFinite(totalSeconds)) return "?";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Parses a seek target: a plain number of seconds ("90") or a timecode
 * ("1:30", "1:02:03"). Returns undefined for anything invalid.
 */
export function parseTimecode(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);

  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) return undefined;
  if (parts.some((part) => !/^\d+$/.test(part))) return undefined;

  let seconds = 0;
  for (const part of parts) {
    seconds = seconds * 60 + Number.parseInt(part, 10);
  }
  return seconds;
}
