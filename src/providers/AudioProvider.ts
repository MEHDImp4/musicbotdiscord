import type { Readable } from "node:stream";
import type { RequestedBy, Track } from "../music/Track";

export interface AudioProvider {
  search(query: string, requestedBy: RequestedBy): Promise<Track>;
  resolve(url: string, requestedBy: RequestedBy): Promise<Track>;
  createReadStream(track: Track): Promise<{ stream: Readable; process: import("node:child_process").ChildProcess }>;
}
