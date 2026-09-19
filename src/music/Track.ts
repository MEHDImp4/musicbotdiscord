export type TrackProvider = "youtube" | "soundcloud" | "radio" | "spotify" | "deezer" | "apple";

export const TRACK_PROVIDERS: readonly TrackProvider[] = [
  "youtube",
  "soundcloud",
  "radio",
  "spotify",
  "deezer",
  "apple",
];

export function isTrackProvider(value: unknown): value is TrackProvider {
  return typeof value === "string" && (TRACK_PROVIDERS as readonly string[]).includes(value);
}

export interface RequestedBy {
  id: string;
  username: string;
}

export interface Track {
  id: string;
  title: string;
  webpageUrl: string;
  thumbnail?: string;
  duration?: number;
  author?: string;
  requestedBy: RequestedBy;
  provider: TrackProvider;
  /** True for live streams (radio): no duration, seek/fade disabled. */
  isLive?: boolean;
}
