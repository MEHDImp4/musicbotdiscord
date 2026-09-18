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
  type AudioResource,
  type VoiceConnection,
} from "@discordjs/voice";
import type { Message, VoiceBasedChannel } from "discord.js";
import { AudioPipeline } from "../audio/AudioPipeline";
import { env } from "../config/env";
import type { AudioProvider } from "../providers/AudioProvider";
import { logger } from "../utils/logger";
import { DEFAULT_GUILD_SETTINGS, type GuildSettings } from "./GuildSettingsStore";
import type { PlayerState } from "./PlayerState";
import { QueueManager } from "./QueueManager";
import type { Track } from "./Track";

export interface AddTrackResult {
  started: boolean;
  position: number;
}

export type LoopMode = "off" | "track" | "queue";

export type NotifyFn = (channelId: string, content: string) => void;

/**
 * Pure decision for the next track to play. Mutates the queue to implement
 * loop-queue semantics. Exported for testability.
 */
export function decideNext(
  finished: Track | undefined,
  loopMode: LoopMode,
  queue: QueueManager,
): Track | undefined {
  if (finished && loopMode === "track") return finished;

  const next = queue.dequeue();

  if (finished && loopMode === "queue") {
    try {
      queue.enqueue(finished);
    } catch {
      // Queue is full: drop the re-queue rather than crash playback.
    }
  }

  return next ?? (finished && loopMode === "queue" ? finished : undefined);
}

export class GuildPlayer {
  readonly queue = new QueueManager(env.maxQueueSize);
  readonly audioPlayer = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });

  private readonly pipeline: AudioPipeline;
  private connection?: VoiceConnection;
  private childProcesses: ChildProcess[] = [];
  private currentResource?: AudioResource;
  private idleTimer?: NodeJS.Timeout;
  private emptyChannelTimer?: NodeJS.Timeout;
  private serial: Promise<unknown> = Promise.resolve();
  private destroyed = false;
  private bypassLoop = false;
  private _currentTrack?: Track;
  private _state: PlayerState = "IDLE";
  private _lastTextChannelId?: string;
  private _volume = 100;
  private _loopMode: LoopMode = "off";
  private readonly skipVotes = new Set<string>();
  private _nowPlayingMessage?: Message;

  constructor(
    readonly guildId: string,
    provider: AudioProvider,
    private readonly onDestroyed: (guildId: string) => void,
    private readonly onNotify?: NotifyFn,
    initialSettings: GuildSettings = DEFAULT_GUILD_SETTINGS,
    private readonly onSettingsChange?: (patch: Partial<GuildSettings>) => void,
  ) {
    this.pipeline = new AudioPipeline(provider);
    this._volume = initialSettings.volume;
    this._loopMode = initialSettings.loopMode;

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
        const finished = this._currentTrack;
        await this.killProcesses();
        this.currentResource = undefined;
        this._currentTrack = undefined;
        this.skipVotes.clear();
        const loopBack = this.bypassLoop ? undefined : finished;
        this.bypassLoop = false;
        await this.playNextInternal(loopBack);
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

  get lastTextChannelId(): string | undefined {
    return this._lastTextChannelId;
  }

  set lastTextChannelId(id: string | undefined) {
    this._lastTextChannelId = id;
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = Math.max(0, Math.min(100, Math.round(value)));
    if (this.currentResource?.volume) {
      this.currentResource.volume.setVolume(this._volume / 100);
    }
    this.onSettingsChange?.({ volume: this._volume });
  }

  get loopMode(): LoopMode {
    return this._loopMode;
  }

  set loopMode(mode: LoopMode) {
    this._loopMode = mode;
    this.onSettingsChange?.({ loopMode: mode });
  }

  get skipVoteCount(): number {
    return this.skipVotes.size;
  }

  get playbackElapsedMs(): number | undefined {
    return this.currentResource?.playbackDuration;
  }

  get nowPlayingMessage(): Message | undefined {
    return this._nowPlayingMessage;
  }

  setNowPlayingMessage(message: Message | undefined): void {
    this._nowPlayingMessage = message;
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

  async playNext(track: Track): Promise<AddTrackResult> {
    return this.runExclusive(async () => {
      this.clearIdleTimer();
      if (!this._currentTrack && this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
        await this.startTrack(track);
        return { started: true, position: 0 };
      }

      const position = this.queue.enqueueFront(track);
      logger.info({ guild: this.guildId, track: track.title }, "Queued next");
      return { started: false, position };
    });
  }

  async voteSkip(userId: string, threshold: number): Promise<{ votes: number; skipped: boolean }> {
    return this.runExclusive(async () => {
      if (!this._currentTrack) return { votes: this.skipVotes.size, skipped: false };

      this.skipVotes.add(userId);
      const votes = this.skipVotes.size;

      if (votes >= threshold) {
        this.skipVotes.clear();
        this.bypassLoop = true;
        await this.killProcesses();
        this.audioPlayer.stop(true);
        return { votes, skipped: true };
      }

      return { votes, skipped: false };
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
      await this.killProcesses();
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
        inlineVolume: true,
      });
      if (resource.volume) resource.volume.setVolume(this._volume / 100);
      this.currentResource = resource;

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
      this.bypassLoop = true;
      await this.killProcesses();
      return this.audioPlayer.stop(true);
    });
  }

  async stop(): Promise<void> {
    return this.runExclusive(async () => {
      this._state = "STOPPING";
      this.queue.clear();
      this._currentTrack = undefined;
      this.skipVotes.clear();
      this.bypassLoop = true;
      await this.killProcesses();
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

  private async playNextInternal(finished?: Track): Promise<void> {
    const next = decideNext(finished, this._loopMode, this.queue);
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
    this.skipVotes.clear();
    await this.killProcesses();

    const attempts = Math.max(1, env.maxStreamRetries + 1);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const { processes, resource } = await this.pipeline.create(track, this._volume);
        this.childProcesses = processes;
        this.currentResource = resource;
        this.audioPlayer.play(resource);
        logger.info(
          {
            guild: this.guildId,
            track: track.title,
            attempt,
            playableConnections: this.audioPlayer.playable.length,
          },
          "Audio resource submitted to player",
        );
        return;
      } catch (error) {
        lastError = error;
        logger.warn(
          { err: error, guild: this.guildId, track: track.title, attempt, attempts },
          "Track start attempt failed",
        );
        await this.killProcesses();
      }
    }

    this._currentTrack = undefined;
    this._state = "ERROR";
    this.notifyTrackError(track, attempts, lastError);
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private notifyTrackError(track: Track, attempts: number, error: unknown): void {
    if (!this.onNotify || !this._lastTextChannelId) return;
    const reason = error instanceof Error ? error.message : "erreur inconnue";
    const suffix = attempts > 1 ? ` après ${attempts} tentatives` : "";
    try {
      this.onNotify(this._lastTextChannelId, `❌ Impossible de lire **${track.title}**${suffix} : ${reason}`);
    } catch (notifyError) {
      logger.warn({ err: notifyError, guild: this.guildId }, "Failed to send error notification");
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

  private async killProcesses(): Promise<void> {
    const processes = this.childProcesses;
    this.childProcesses = [];

    // Phase 1: Send SIGTERM to all processes
    for (const proc of processes) {
      if (!proc.killed) {
        proc.kill("SIGTERM");
      }
    }

    // Phase 2: Wait up to 1 second for graceful exit, then SIGKILL
    const SIGTERM_GRACE_MS = 1_000;
    await new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const killTimer = setTimeout(() => {
        for (const proc of processes) {
          if (!proc.killed) {
            proc.kill("SIGKILL");
            logger.warn({ pid: proc.pid }, "Force-killed process with SIGKILL after timeout");
          }
        }
        done();
      }, SIGTERM_GRACE_MS);

      // If all processes exit before timeout, clear the timer
      const checkAllExited = () => {
        if (processes.every((p) => p.exitCode !== null || p.killed)) {
          clearTimeout(killTimer);
          done();
        }
      };

      for (const proc of processes) {
        proc.on("exit", checkAllExited);
      }

      // Also check immediately in case processes are already dead
      checkAllExited();
    });

    logger.debug({ count: processes.length }, "All child processes terminated");
  }

  private async destroyInternal(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearIdleTimer();
    this.clearEmptyChannelTimer();
    this.queue.clear();
    this._currentTrack = undefined;
    this._lastTextChannelId = undefined;
    this.currentResource = undefined;
    this._nowPlayingMessage = undefined;
    this.skipVotes.clear();
    await this.killProcesses();
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
