import { env } from "../config/env";
import type { RequestedBy, Track } from "../music/Track";
import { runProcess } from "../utils/process";
import type { AudioProvider } from "./AudioProvider";

interface YtDlpInfo {
  id?: string;
  title?: string;
  webpage_url?: string;
  original_url?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  channel?: string;
}

function isAllowedYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host);
  } catch {
    return false;
  }
}

function toTrack(info: YtDlpInfo, requestedBy: RequestedBy): Track {
  const id = info.id?.trim();
  const title = info.title?.trim();
  const webpageUrl = info.webpage_url?.trim() || info.original_url?.trim();

  if (!id || !title || !webpageUrl) {
    throw new Error("yt-dlp returned incomplete track metadata");
  }

  return {
    id,
    title,
    webpageUrl,
    thumbnail: info.thumbnail || undefined,
    duration: typeof info.duration === "number" ? info.duration : undefined,
    author: info.uploader || info.channel || undefined,
    requestedBy,
    provider: "youtube",
  };
}

export class YouTubeProvider implements AudioProvider {
  async search(query: string, requestedBy: RequestedBy): Promise<Track> {
    const normalized = query.trim();
    if (!normalized) throw new Error("Search query is empty");

    const info = await this.fetchInfo(`ytsearch1:${normalized}`);
    return toTrack(info, requestedBy);
  }

  async resolve(url: string, requestedBy: RequestedBy): Promise<Track> {
    if (!isAllowedYouTubeUrl(url)) {
      throw new Error("Only YouTube URLs are supported in the MVP");
    }
    const info = await this.fetchInfo(url);
    return toTrack(info, requestedBy);
  }

  async getStreamUrl(track: Track): Promise<string> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= env.maxStreamRetries; attempt += 1) {
      try {
        const { stdout } = await runProcess(
          env.ytdlpPath,
          ["--no-playlist", "--no-warnings", "-f", "bestaudio/best", "-g", track.webpageUrl],
          { timeoutMs: env.externalProcessTimeoutMs, maxOutputBytes: 200_000 },
        );
        const streamUrl = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
        if (!streamUrl) throw new Error("yt-dlp did not return a playable stream URL");
        return streamUrl;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Unable to resolve audio stream");
  }

  private async fetchInfo(target: string): Promise<YtDlpInfo> {
    const { stdout } = await runProcess(
      env.ytdlpPath,
      ["--dump-json", "--skip-download", "--no-playlist", "--no-warnings", target],
      { timeoutMs: env.externalProcessTimeoutMs },
    );

    try {
      const line = stdout.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
      if (!line) throw new Error("Empty yt-dlp metadata response");
      return JSON.parse(line) as YtDlpInfo;
    } catch {
      throw new Error("Unable to parse yt-dlp metadata");
    }
  }
}
