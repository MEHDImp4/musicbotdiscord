import { spawn, type ChildProcess } from "node:child_process";
import { createAudioResource, StreamType, type AudioResource } from "@discordjs/voice";
import { env } from "../config/env";
import type { Track } from "../music/Track";
import type { AudioProvider } from "../providers/AudioProvider";
import { logger } from "../utils/logger";

export interface AudioPipelineResult {
  process: ChildProcess;
  resource: AudioResource<Track>;
}

export class AudioPipeline {
  constructor(private readonly provider: AudioProvider) {}

  async create(track: Track): Promise<AudioPipelineResult> {
    const streamUrl = await this.provider.getStreamUrl(track);

    const ffmpeg = spawn(
      env.ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-nostdin",
        "-i",
        streamUrl,
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
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        windowsHide: true,
      },
    );

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      logger.debug({ track: track.title, ffmpeg: chunk.toString("utf8").trim() }, "ffmpeg");
    });

    ffmpeg.on("error", (error) => {
      logger.error({ err: error, track: track.title }, "ffmpeg process error");
    });

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
      metadata: track,
    });

    return { process: ffmpeg, resource };
  }
}
