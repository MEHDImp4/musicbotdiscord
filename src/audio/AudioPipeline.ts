import { spawn, type ChildProcess } from "node:child_process";
import { createAudioResource, StreamType, type AudioResource } from "@discordjs/voice";
import { env } from "../config/env";
import type { Track } from "../music/Track";
import type { AudioProvider } from "../providers/AudioProvider";
import { logger } from "../utils/logger";

export interface AudioPipelineResult {
  processes: ChildProcess[];
  resource: AudioResource<Track>;
}

export class AudioPipeline {
  constructor(private readonly provider: AudioProvider) {}

  async create(track: Track): Promise<AudioPipelineResult> {
    const { stream: audioStream, process: ytdlpProcess } = await this.provider.createReadStream(track);

    const ffmpeg = spawn(
      env.ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-nostdin",
        "-i",
        "pipe:0",
        "-vn",
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "pipe:1",
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
        windowsHide: true,
      },
    );

    let ffmpegStderr = "";

    audioStream.pipe(ffmpeg.stdin);

    audioStream.on("error", (error) => {
      logger.error({ err: error, track: track.title }, "yt-dlp stream error");
    });

    ffmpeg.stdin.on("error", (error) => {
      logger.debug({ err: error, track: track.title }, "FFmpeg stdin closed");
    });

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      ffmpegStderr = (ffmpegStderr + text).slice(-8000);
      logger.debug({ track: track.title, ffmpeg: text.trim() }, "FFmpeg stderr");
    });

    ffmpeg.on("error", (error) => {
      logger.error({ err: error, track: track.title }, "FFmpeg process error");
    });

    ffmpeg.on("close", (code, signal) => {
      if (code !== 0 && signal !== "SIGKILL") {
        logger.error(
          {
            track: track.title,
            code,
            signal,
            stderr: ffmpegStderr.trim(),
          },
          "FFmpeg exited with an error",
        );
      } else {
        logger.info({ track: track.title, code, signal }, "FFmpeg exited");
      }
    });

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
      metadata: track,
    });

    return { processes: [ytdlpProcess, ffmpeg], resource };
  }
}
