import type { Track, TrackProvider } from "../music/Track";
import { pickRelatedTrack } from "../services/autoplay";
import { logger } from "../utils/logger";
import { isYouTubeUrl, mixUrl, watchUrl } from "./youtube";
import { YtDlpProvider } from "./YtDlpProvider";

export class YouTubeProvider extends YtDlpProvider {
  readonly name = "youtube" as TrackProvider;
  protected readonly searchPrefix = "ytsearch";

  protected isAllowedUrl(url: string): boolean {
    return isYouTubeUrl(url);
  }

  protected urlFromId(id: string): string | undefined {
    return watchUrl(id);
  }

  async related(seed: Track, exclude: ReadonlySet<string>): Promise<Track | undefined> {
    if (!seed.id) return undefined;

    try {
      const mix = await this.fetchEntries(mixUrl(seed.id), 20);
      const fromMix = pickRelatedTrack(this.toTracks(mix.entries, seed.requestedBy), seed.id, exclude);
      if (fromMix) return fromMix;
    } catch (error) {
      logger.debug({ err: error, track: seed.title }, "YouTube mix lookup failed, falling back to search");
    }

    const query = seed.author ? `${seed.author} ${seed.title}` : seed.title;
    const candidates = this.toTracks(
      (await this.fetchEntries(`ytsearch5:${query}`, 5)).entries,
      seed.requestedBy,
    );
    return pickRelatedTrack(candidates, seed.id, exclude);
  }
}
