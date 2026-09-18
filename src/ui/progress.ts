import { formatDuration } from "../utils/time";

export function renderProgressBar(elapsedMs: number, totalSeconds?: number, length = 18): string {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

  if (totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return `▶ ${formatDuration(elapsedSeconds)}`;
  }

  const ratio = Math.max(0, Math.min(1, elapsedMs / (totalSeconds * 1000)));
  const filled = Math.round(ratio * length);
  const bar = `${"▬".repeat(filled)}🔘${"▬".repeat(Math.max(0, length - filled))}`;

  return `${bar}\n\`${formatDuration(elapsedSeconds)} / ${formatDuration(totalSeconds)}\``;
}
