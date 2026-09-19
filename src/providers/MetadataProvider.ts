import type { RequestedBy, Track, TrackProvider } from "../music/Track";
import type { AudioProvider, AudioSource } from "./AudioProvider";

/**
 * Base for metadata-only sources (Spotify/Deezer/Apple Music): they resolve the
 * link to a title/artist, then delegate playback to a real stream provider.
 */
export abstract class MetadataProvider implements AudioProvider {
  abstract readonly name: TrackProvider;

  constructor(protected readonly searcher: AudioProvider) {}

  abstract supports(url: string): boolean;

  async search(): Promise<Track> {
    throw new Error(`La recherche n'est pas supportée par ${this.name}.`);
  }

  abstract resolve(url: string, requestedBy: RequestedBy): Promise<Track>;

  async createSource(): Promise<AudioSource> {
    throw new Error("La lecture est déléguée à un autre fournisseur.");
  }

  protected async searchOnYouTube(query: string, requestedBy: RequestedBy): Promise<Track> {
    const trimmed = query.trim();
    if (!trimmed) throw new Error("Métadonnées introuvables pour ce lien.");
    return this.searcher.search(trimmed, requestedBy);
  }
}
