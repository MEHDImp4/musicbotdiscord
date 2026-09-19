import type { RequestedBy, Track, TrackProvider } from "../music/Track";
import { fetchJson } from "../utils/http";
import { asString } from "../utils/strings";
import { MetadataProvider } from "./MetadataProvider";

interface DeezerTrack {
  title?: string;
  duration?: number;
  artist?: { name?: string };
}

function isDeezerUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "deezer.com" || host.endsWith(".deezer.com");
  } catch {
    return false;
  }
}

export function extractDeezerTrackId(value: string): string | undefined {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/track\/(\d+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export class DeezerProvider extends MetadataProvider {
  readonly name = "deezer" as TrackProvider;

  supports(url: string): boolean {
    return isDeezerUrl(url);
  }

  async resolve(url: string, requestedBy: RequestedBy): Promise<Track> {
    const id = extractDeezerTrackId(url);
    if (!id) throw new Error("Lien Deezer non reconnu (morceau attendu).");

    const payload = (await fetchJson(`https://api.deezer.com/track/${id}`)) as DeezerTrack;
    const title = asString(payload.title);
    if (!title) throw new Error("Métadonnées Deezer introuvables.");

    const artist = asString(payload.artist?.name);
    const query = artist ? `${artist} ${title}` : title;
    return this.searchOnYouTube(query, requestedBy);
  }
}
