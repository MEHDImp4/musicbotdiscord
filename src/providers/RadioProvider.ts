import type { RequestedBy, Track, TrackProvider } from "../music/Track";
import type { AudioProvider, AudioSource } from "./AudioProvider";

export function deriveRadioTitle(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    const name = last ? decodeURIComponent(last) : parsed.hostname;
    return `${name} — ${parsed.hostname}`;
  } catch {
    return url;
  }
}

/**
 * Plays direct HTTP(S) audio streams (Icecast/radio). Used as a fallback for
 * any http URL not claimed by a more specific provider.
 */
export class RadioProvider implements AudioProvider {
  readonly name = "radio" as TrackProvider;

  supports(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  async search(): Promise<Track> {
    throw new Error("La recherche n'est pas supportée pour les flux radio.");
  }

  async resolve(url: string, requestedBy: RequestedBy): Promise<Track> {
    return {
      id: url,
      title: deriveRadioTitle(url),
      webpageUrl: url,
      requestedBy,
      provider: "radio",
      isLive: true,
    };
  }

  async createSource(track: Track): Promise<AudioSource> {
    return { kind: "url", url: track.webpageUrl };
  }
}
