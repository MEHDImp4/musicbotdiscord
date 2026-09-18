export const DEFAULT_VOLUME_HEADROOM_DB = 3;
export const DEFAULT_VOLUME_RANGE_DB = 30;

/**
 * Converts a 0-100 user volume into a linear gain using a decibel scale so the
 * perceived steps are even (each 10% is a constant dB step). Linear gain (p/100)
 * makes high values sound identical and low values hyper-sensitive.
 *
 * dB(p) = -(headroomDb + (1 - p/100) * rangeDb), 0% = mute.
 */
export function percentToGain(
  percent: number,
  headroomDb = DEFAULT_VOLUME_HEADROOM_DB,
  rangeDb = DEFAULT_VOLUME_RANGE_DB,
): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  const clamped = Math.min(100, percent);
  const db = -(headroomDb + (1 - clamped / 100) * rangeDb);
  return Math.pow(10, db / 20);
}

export function volumeEmoji(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return "🔇";
  if (percent <= 33) return "🔈";
  if (percent <= 66) return "🔉";
  return "🔊";
}

export function formatVolume(percent: number): string {
  const rounded = Math.max(0, Math.min(100, Math.round(percent)));
  return `${volumeEmoji(rounded)} ${rounded}%`;
}
