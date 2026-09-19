import type { RequestedBy, Track, TrackProvider } from "../music/Track";
import { fetchJson } from "../utils/http";
import { logger } from "../utils/logger";
import { asNumber, asString } from "../utils/strings";
import { MetadataProvider } from "./MetadataProvider";

interface SpotifyTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface SpotifyTrack {
  name?: string;
  duration_ms?: number;
  artists?: Array<{ name?: string }>;
}

function isSpotifyUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "open.spotify.com" || host.endsWith(".spotify.com");
  } catch {
    return false;
  }
}

export function extractSpotifyTrackId(value: string): string | undefined {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/track\/([A-Za-z0-9]+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export class SpotifyProvider extends MetadataProvider {
  readonly name = "spotify" as TrackProvider;
  private token?: { value: string; expiresAt: number };
  private tokenPromise?: Promise<string>;

  constructor(
    searcher: MetadataProvider["searcher"],
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {
    super(searcher);
  }

  supports(url: string): boolean {
    return isSpotifyUrl(url);
  }

  async resolve(url: string, requestedBy: RequestedBy): Promise<Track> {
    const id = extractSpotifyTrackId(url);
    if (!id) throw new Error("Lien Spotify non reconnu (morceau attendu).");

    const token = await this.getToken();
    const payload = (await fetchJson(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })) as SpotifyTrack;

    const title = asString(payload.name);
    if (!title) throw new Error("Métadonnées Spotify introuvables.");

    const artists = Array.isArray(payload.artists)
      ? payload.artists
          .map((artist) => asString(artist?.name))
          .filter((name): name is string => name !== undefined)
          .join(" ")
      : "";
    return this.searchOnYouTube(artists ? `${artists} ${title}` : title, requestedBy);
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.value;
    }

    // Memoize the in-flight refresh so concurrent calls share one token request.
    this.tokenPromise ??= this.refreshToken().finally(() => {
      this.tokenPromise = undefined;
    });
    return this.tokenPromise;
  }

  private async refreshToken(): Promise<string> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const payload = (await fetchJson("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })) as SpotifyTokenResponse;

    const accessToken = asString(payload.access_token);
    if (!accessToken) throw new Error("Authentification Spotify échouée.");

    const expiresIn = asNumber(payload.expires_in);
    const ttlSeconds = expiresIn !== undefined && expiresIn > 0 ? Math.min(expiresIn, 86_400) : 3600;

    this.token = {
      value: accessToken,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    logger.debug("Refreshed Spotify access token");
    return this.token.value;
  }
}
