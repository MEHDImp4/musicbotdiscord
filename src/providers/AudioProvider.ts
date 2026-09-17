import type { RequestedBy, Track } from "../music/Track";

export interface AudioProvider {
  search(query: string, requestedBy: RequestedBy): Promise<Track>;
  resolve(url: string, requestedBy: RequestedBy): Promise<Track>;
  getStreamUrl(track: Track): Promise<string>;
}
