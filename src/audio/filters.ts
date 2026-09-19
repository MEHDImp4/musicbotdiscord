export type FilterPreset =
  | "off"
  | "bassboost"
  | "nightcore"
  | "vaporwave"
  | "8d"
  | "treble"
  | "loudnorm";

export const FILTER_PRESETS: readonly FilterPreset[] = [
  "off",
  "bassboost",
  "nightcore",
  "vaporwave",
  "8d",
  "treble",
  "loudnorm",
];

export const FILTER_LABELS: Record<FilterPreset, string> = {
  off: "Désactivé",
  bassboost: "Bass Boost",
  nightcore: "Nightcore",
  vaporwave: "Vaporwave",
  "8d": "8D",
  treble: "Treble",
  loudnorm: "Normalisation",
};

/**
 * FFmpeg filter chains per preset. Presets are mutually exclusive: a single
 * chain is built so effects cannot stack unpredictably.
 */
const FILTER_CHAINS: Record<Exclude<FilterPreset, "off">, string> = {
  bassboost: "bass=g=5",
  nightcore: "asetrate=48000*1.25,aresample=48000",
  vaporwave: "asetrate=48000*0.8,aresample=48000",
  "8d": "aformat=channel_layouts=stereo,apulsator=hz=0.09",
  treble: "treble=g=5",
  loudnorm: "loudnorm=I=-16:TP=-1.5:LRA=11",
};

/** Short fade used to avoid clicks at track boundaries. */
export const FADE_SECONDS = 2;

export function isFilterPreset(value: unknown): value is FilterPreset {
  return typeof value === "string" && (FILTER_PRESETS as readonly string[]).includes(value);
}

/**
 * Builds the `-af` chain for a preset, adding a fade-in at the start and a
 * fade-out near the end when the duration is known. Pure and testable.
 */
export function buildFilterChain(
  preset: FilterPreset,
  totalDurationSeconds?: number,
  startSeconds = 0,
): string | undefined {
  const parts: string[] = [];

  if (preset !== "off") parts.push(FILTER_CHAINS[preset]);

  // With an output seek the first `startSeconds` are discarded, so a fade-in
  // anchored at 0 would be lost; only apply it when starting from the top.
  if (startSeconds <= 0) {
    parts.push(`afade=t=in:st=0:d=${FADE_SECONDS}`);
  }

  // `-ss` is an output seek: the filter graph still sees the full timeline, so
  // the fade-out must be anchored to the absolute end, not to the remaining time.
  if (totalDurationSeconds !== undefined && Number.isFinite(totalDurationSeconds)) {
    const remaining = totalDurationSeconds - Math.max(0, startSeconds);
    if (remaining > FADE_SECONDS * 2) {
      const fadeOutStart = Number((totalDurationSeconds - FADE_SECONDS).toFixed(3));
      if (fadeOutStart > 0) {
        parts.push(`afade=t=out:st=${fadeOutStart}:d=${FADE_SECONDS}`);
      }
    }
  }

  return parts.length > 0 ? parts.join(",") : undefined;
}
