import type { ChildProcess } from "node:child_process";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
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
  private ffmpeg?: ChildProcess;
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
      if (this._currentTrack) {
        logger.info({ guild: this.guildId, track: this._currentTrack.title }, "Playback started");
      }
    });

    this.audioPlayer.on(AudioPlayerStatus.Paused, () => {
      this._state = "PAUSED";
    });

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      void this.runExclusive(async () => {
        if (this.destroyed) return;
        this.killFfmpeg();
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

      this.connection.subscribe(this.audioPlayer);

      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, env.voiceConnectionTimeoutMs);
        this._state = this._currentTrack ? "PLAYING" : "IDLE";
        logger.info({ guild: this.guildId, channel: channel.id }, "Connected to voice channel");
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

  async pause(): Promise<boolean> {
    return this.runExclusive(async () => this.audioPlayer.pause());
  }

  async resume(): Promise<boolean> {
    return this.runExclusive(async () => this.audioPlayer.unpause());
  }

  async skip(): Promise<boolean> {
    return this.runExclusive(async () => {
      if (!this._currentTrack) return false;
      this.killFfmpeg();
      return this.audioPlayer.stop(true);
    });
  }

  async stop(): Promise<void> {
    return this.runExclusive(async () => {
      this._state = "STOPPING";
      this.queue.clear();
      this._currentTrack = undefined;
      this.killFfmpeg();
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
    if (!this.connection || this.connection.state.status === VoiceConnectionStatus.Destroyed) {
      throw new Error("Bot is not connected to a voice channel");
    }

    this.clearIdleTimer();
    this._state = "BUFFERING";
    this._currentTrack = track;
    this.killFfmpeg();

    try {
      const { process, resource } = await this.pipeline.create(track);
      this.ffmpeg = process;
      this.audioPlayer.play(resource);
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

  private killFfmpeg(): void {
    if (this.ffmpeg && !this.ffmpeg.killed) this.ffmpeg.kill("SIGKILL");
    this.ffmpeg = undefined;
  }

  private async destroyInternal(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearIdleTimer();
    this.clearEmptyChannelTimer();
    this.queue.clear();
    this._currentTrack = undefined;
    this.killFfmpeg();
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
