import { spawn, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { runProcess } from "../utils/process";
import type { RequestedBy, Track } from "../music/Track";
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

function commonArgs(): string[] {
  const args = ["--js-runtimes", "node", "--no-playlist", "--no-warnings"];
  if (env.ytdlpCookiesFile) {
    args.push("--cookies", env.ytdlpCookiesFile);
  }
  return args;
}

function streamArgs(): string[] {
  const args = [...commonArgs()];
  if (env.sponsorblockCategories) {
    args.push("--sponsorblock-remove", env.sponsorblockCategories);
  }
  return args;
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

  async createReadStream(track: Track): Promise<{ stream: Readable; process: ChildProcess }> {
    const args = [
      ...streamArgs(),
      "-f",
      "bestaudio/best",
      "-o",
      "-",
      track.webpageUrl,
    ];

    const ytdlp = spawn(
      env.ytdlpPath,
      args,
      { stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true },
    );

    let stderr = "";

    ytdlp.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr = (stderr + text).slice(-8000);
      logger.debug({ track: track.title, ytdlp: text.trim() }, "yt-dlp stderr");
    });

    ytdlp.on("error", (error) => {
      logger.error({ err: error, track: track.title }, "yt-dlp process error");
    });

    ytdlp.on("close", (code, signal) => {
      if (code !== 0) {
        logger.error(
          {
            track: track.title,
            code,
            signal,
            stderr: stderr.trim(),
          },
          "yt-dlp exited with an error",
        );
      } else {
        logger.info(
          { track: track.title, code, signal },
          "yt-dlp stream finished",
        );
      }
    });

    return { stream: ytdlp.stdout, process: ytdlp };
  }

  private async fetchInfo(target: string): Promise<YtDlpInfo> {
    const { stdout } = await runProcess(
      env.ytdlpPath,
      [...commonArgs(), "--dump-json", "--skip-download", target],
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
