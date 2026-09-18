import { spawn, type ChildProcess } from "node:child_process";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type VoiceConnection,
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
import { AudioPipeline } from "../audio/AudioPipeline";
import { env } from "../config/env";
import type { AudioProvider } from "../providers/AudioProvider";
import { logger } from "../utils/logger";
import type { PlayerState } from "./PlayerState";
import { QueueManager } from "./QueueManager";
import type { Track } from "./Track";

export interface AddTrackResult {
  started: boolean;
  position: number;
}

export class GuildPlayer {
  readonly queue = new QueueManager(env.maxQueueSize);
  readonly audioPlayer = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });

  private readonly pipeline: AudioPipeline;
  private connection?: VoiceConnection;
  private childProcesses: ChildProcess[] = [];
  private idleTimer?: NodeJS.Timeout;
  private emptyChannelTimer?: NodeJS.Timeout;
  private serial: Promise<unknown> = Promise.resolve();
  private destroyed = false;
  private _currentTrack?: Track;
  private _state: PlayerState = "IDLE";

  constructor(
    readonly guildId: string,
    provider: AudioProvider,
    private readonly onDestroyed: (guildId: string) => void,
  ) {
    this.pipeline = new AudioPipeline(provider);

    this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
      this._state = "PLAYING";
      logger.info(
        {
          guild: this.guildId,
          track: this._currentTrack?.title ?? "diagnostic-tone",
          playableConnections: this.audioPlayer.playable.length,
        },
        "Audio player entered PLAYING",
      );
    });

    this.audioPlayer.on(AudioPlayerStatus.Paused, () => {
      this._state = "PAUSED";
    });

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      void this.runExclusive(async () => {
        if (this.destroyed) return;
        logger.info({ guild: this.guildId }, "Audio player entered IDLE");
        this.killProcesses();
        this._currentTrack = undefined;
        await this.playNextInternal();
      });
    });

    this.audioPlayer.on("error", (error) => {
      logger.error(
        { err: error, guild: this.guildId },
        "Audio player error",
      );
      this._state = "ERROR";
      this.audioPlayer.stop(true);
    });

    this.audioPlayer.on("debug", (message) => {
      logger.debug({ guild: this.guildId, message }, "Audio player debug");
    });
  }

  get currentTrack(): Track | undefined {
    return this._currentTrack;
  }

  get state(): PlayerState {
    return this._state;
  }

  get channelId(): string | undefined {
    return this.connection?.joinConfig.channelId || undefined;
  }

  get queueSize(): number {
    return this.queue.size;
  }

  get isConnected(): boolean {
    return Boolean(this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed);
  }

  async connect(channel: VoiceBasedChannel): Promise<void> {
    return this.runExclusive(async () => {
      if (this.destroyed) throw new Error("Player is destroyed");
      this.clearIdleTimer();
      this.clearEmptyChannelTimer();

      if (this.connection && this.channelId === channel.id) return;
      if (this.connection && this.channelId !== channel.id) {
        throw new Error("Bot is already connected to another voice channel in this server");
      }

      this._state = "CONNECTING";
      this.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      this.connection.on("error", (error) => {
        logger.error({ err: error, guild: this.guildId }, "Voice connection error");
      });

      this.connection.on("debug", (message) => {
        logger.debug({ guild: this.guildId, message }, "Voice connection debug");
      });

      this.connection.on("stateChange", (oldState, newState) => {
        logger.info(
          {
            guild: this.guildId,
            from: oldState.status,
            to: newState.status,
          },
          "Voice connection state changed",
        );
      });

      const subscription = this.connection.subscribe(this.audioPlayer);
      if (!subscription) {
        throw new Error("Unable to subscribe the audio player to the voice connection");
      }

      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, env.voiceConnectionTimeoutMs);
        this._state = this._currentTrack ? "PLAYING" : "IDLE";
        logger.info(
          {
            guild: this.guildId,
            channel: channel.id,
            wsPing: this.connection.ping.ws,
            udpPing: this.connection.ping.udp,
            privacyCode: this.connection.voicePrivacyCode ? "available" : "unavailable",
          },
          "Connected to voice channel",
        );
      } catch (error) {
        this.connection.destroy();
        this.connection = undefined;
        this._state = "ERROR";
        throw error;
      }
    });
  }

  async add(track: Track): Promise<AddTrackResult> {
    return this.runExclusive(async () => {
      this.clearIdleTimer();
      if (!this._currentTrack && this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
        await this.startTrack(track);
        return { started: true, position: 0 };
      }

      const position = this.queue.enqueue(track);
      logger.info({ guild: this.guildId, track: track.title, position }, "Added to queue");
      return { started: false, position };
    });
  }

  async playDiagnosticTone(): Promise<void> {
    return this.runExclusive(async () => {
      if (!this.connection || this.connection.state.status !== VoiceConnectionStatus.Ready) {
        throw new Error("Voice connection is not ready");
      }

      if (this._currentTrack || this.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
        throw new Error("Stop the current playback before running /testaudio");
      }

      this.clearIdleTimer();
      this.killProcesses();
      this._state = "BUFFERING";

      const ffmpeg = spawn(
        env.ffmpegPath,
        [
          "-hide_banner",
          "-loglevel",
          "warning",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:sample_rate=48000:duration=3",
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
        logger.warn(
          { guild: this.guildId, ffmpeg: chunk.toString("utf8").trim() },
          "Diagnostic FFmpeg stderr",
        );
      });

      ffmpeg.on("error", (error) => {
        logger.error({ err: error, guild: this.guildId }, "Diagnostic FFmpeg process error");
      });

      ffmpeg.on("close", (code, signal) => {
        logger.info({ guild: this.guildId, code, signal }, "Diagnostic FFmpeg exited");
      });

      this.childProcesses = [ffmpeg];

      const resource = createAudioResource(ffmpeg.stdout, {
        inputType: StreamType.Raw,
      });

      this.audioPlayer.play(resource);
      logger.info({ guild: this.guildId }, "Started 440 Hz diagnostic tone");
    });
  }

  async pause(): Promise<boolean> {
    return this.runExclusive(async () => this.audioPlayer.pause());
  }

  async resume(): Promise<boolean> {
    return this.runExclusive(async () => this.audioPlayer.unpause());
  }

  async skip(): Promise<boolean> {
    return this.runExclusive(async () => {
      if (!this._currentTrack) return false;
      this.killProcesses();
      return this.audioPlayer.stop(true);
    });
  }

  async stop(): Promise<void> {
    return this.runExclusive(async () => {
      this._state = "STOPPING";
      this.queue.clear();
      this._currentTrack = undefined;
      this.killProcesses();
      this.audioPlayer.stop(true);
      this._state = "IDLE";
      this.scheduleIdleDisconnect();
    });
  }

  async destroy(): Promise<void> {
    return this.runExclusive(async () => this.destroyInternal());
  }

  handleHumansEmpty(): void {
    if (this.emptyChannelTimer || this.destroyed) return;
    this.emptyChannelTimer = setTimeout(() => {
      void this.runExclusive(async () => this.destroyInternal());
    }, env.emptyChannelTimeoutSeconds * 1000);
  }

  handleHumansPresent(): void {
    this.clearEmptyChannelTimer();
  }

  private async playNextInternal(): Promise<void> {
    const next = this.queue.dequeue();
    if (!next) {
      this._state = "IDLE";
      this.scheduleIdleDisconnect();
      return;
    }

    try {
      await this.startTrack(next);
    } catch (error) {
      logger.warn({ err: error, guild: this.guildId, track: next.title }, "Skipping unreadable track");
      this._currentTrack = undefined;
      await this.playNextInternal();
    }
  }

  private async startTrack(track: Track): Promise<void> {
    if (!this.connection || this.connection.state.status !== VoiceConnectionStatus.Ready) {
      throw new Error("Voice connection is not ready");
    }

    this.clearIdleTimer();
    this._state = "BUFFERING";
    this._currentTrack = track;
    this.killProcesses();

    try {
      const { processes, resource } = await this.pipeline.create(track);
      this.childProcesses = processes;
      this.audioPlayer.play(resource);
      logger.info(
        {
          guild: this.guildId,
          track: track.title,
          playableConnections: this.audioPlayer.playable.length,
        },
        "Audio resource submitted to player",
      );
    } catch (error) {
      this._currentTrack = undefined;
      this._state = "ERROR";
      throw error;
    }
  }

  private scheduleIdleDisconnect(): void {
    this.clearIdleTimer();
    if (!this.connection || this.destroyed) return;
    this.idleTimer = setTimeout(() => {
      void this.runExclusive(async () => this.destroyInternal());
    }, env.idleTimeoutSeconds * 1000);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private clearEmptyChannelTimer(): void {
    if (this.emptyChannelTimer) clearTimeout(this.emptyChannelTimer);
    this.emptyChannelTimer = undefined;
  }

  private killProcesses(): void {
    for (const proc of this.childProcesses) {
      if (!proc.killed) proc.kill("SIGKILL");
    }
    this.childProcesses = [];
  }

  private async destroyInternal(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearIdleTimer();
    this.clearEmptyChannelTimer();
    this.queue.clear();
    this._currentTrack = undefined;
    this.killProcesses();
    this.audioPlayer.stop(true);
    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
    }
    this.connection = undefined;
    this._state = "IDLE";
    this.onDestroyed(this.guildId);
    logger.info({ guild: this.guildId }, "Guild player destroyed");
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.serial.then(operation, operation);
    this.serial = next.then(() => undefined, () => undefined);
    return next;
  }
}
