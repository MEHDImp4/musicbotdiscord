import { join } from "node:path";
import type { Client } from "discord.js";
import { env } from "../config/env";
import type { AudioProvider } from "../providers/AudioProvider";
import { logger } from "../utils/logger";
import { GuildPlayer } from "./GuildPlayer";
import { GuildSettingsStore, type GuildSettings } from "./GuildSettingsStore";
import type { RequestedBy, Track } from "./Track";

export class PlayerManager {
  private readonly players = new Map<string, GuildPlayer>();
  private readonly settings: GuildSettingsStore;

  constructor(
    private readonly provider: AudioProvider,
    private readonly client?: Client,
  ) {
    this.settings = new GuildSettingsStore(join(env.dataDir, "guild-settings.json"));
    this.settings.load();
  }

  get(guildId: string): GuildPlayer | undefined {
    return this.players.get(guildId);
  }

  getOrCreate(guildId: string): GuildPlayer {
    const existing = this.players.get(guildId);
    if (existing) return existing;

    const player = new GuildPlayer(
      guildId,
      this.provider,
      (id) => {
        if (this.players.get(id) === player) this.players.delete(id);
      },
      (channelId, content) => {
        void this.notify(channelId, content);
      },
      this.settings.get(guildId),
      (patch) => {
        this.settings.update(guildId, patch);
      },
    );
    this.players.set(guildId, player);
    return player;
  }

  private async notify(channelId: string, content: string): Promise<void> {
    if (!this.client) return;
    try {
      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased() && !channel.isDMBased()) {
        await channel.send(content);
      }
    } catch (error) {
      logger.warn({ err: error, channelId }, "Failed to deliver notification");
    }
  }

  async destroy(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (player) await player.destroy();
    this.players.delete(guildId);
  }

  async destroyAll(): Promise<void> {
    await Promise.all([...this.players.values()].map((player) => player.destroy()));
    this.players.clear();
  }

  getGuildSettings(guildId: string): GuildSettings {
    return this.settings.get(guildId);
  }

  /** Persists any pending guild settings immediately. */
  flushSettings(): void {
    this.settings.flush();
  }

  async resolveTrack(input: string, requestedBy: RequestedBy): Promise<Track> {
    const trimmed = input.trim();
    const track = /^https?:\/\//i.test(trimmed)
      ? await this.provider.resolve(trimmed, requestedBy)
      : await this.provider.search(trimmed, requestedBy);

    const maxSeconds = env.maxTrackDurationMinutes * 60;
    if (track.duration !== undefined && maxSeconds > 0 && track.duration > maxSeconds) {
      throw new Error(`Track exceeds maximum duration of ${env.maxTrackDurationMinutes} minutes`);
    }

    return track;
  }

  get size(): number {
    return this.players.size;
  }

  get activeGuildIds(): string[] {
    return [...this.players.entries()]
      .filter(([, player]) => player.isConnected)
      .map(([guildId]) => guildId);
  }

  activePlayers(): GuildPlayer[] {
    return [...this.players.values()].filter((player) => player.isConnected);
  }
}
