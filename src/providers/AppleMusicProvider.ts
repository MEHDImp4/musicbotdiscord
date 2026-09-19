import type { RequestedBy, Track, TrackProvider } from "../music/Track";
import { fetchJson } from "../utils/http";
import { MetadataProvider } from "./MetadataProvider";

interface ITunesLookup {
  results?: Array<{ trackName?: string; artistName?: string }>;
}

function isAppleMusicUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "music.apple.com";
  } catch {
    return false;
  }
}

export function extractAppleTrackId(value: string): string | undefined {
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get("i");
    if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;
    const match = url.pathname.match(/\/(\d+)$/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export class AppleMusicProvider extends MetadataProvider {
  readonly name = "apple" as TrackProvider;

  supports(url: string): boolean {
    return isAppleMusicUrl(url);
  }

  async resolve(url: string, requestedBy: RequestedBy): Promise<Track> {
    const id = extractAppleTrackId(url);
    if (!id) throw new Error("Lien Apple Music non reconnu (morceau attendu).");

    const payload = (await fetchJson(`https://itunes.apple.com/lookup?id=${id}`)) as ITunesLookup;
    const result = payload.results?.[0];
    const title = result?.trackName?.trim();
    if (!result || !title) throw new Error("Métadonnées Apple Music introuvables.");

    const query = result.artistName ? `${result.artistName} ${title}` : title;
    return this.searchOnYouTube(query, requestedBy);
  }
}
