import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "../utils/logger";
import type { LoopMode } from "./GuildPlayer";

export interface GuildSettings {
  volume: number;
  loopMode: LoopMode;
}

export const DEFAULT_GUILD_SETTINGS: GuildSettings = { volume: 100, loopMode: "off" };

const LOOP_MODES: readonly LoopMode[] = ["off", "track", "queue"];

export function sanitizeSettings(input: unknown): GuildSettings {
  const raw = (input ?? {}) as Partial<GuildSettings>;

  const volume =
    typeof raw.volume === "number" && Number.isFinite(raw.volume)
      ? Math.max(0, Math.min(100, Math.round(raw.volume)))
      : DEFAULT_GUILD_SETTINGS.volume;

  const loopMode = LOOP_MODES.includes(raw.loopMode as LoopMode)
    ? (raw.loopMode as LoopMode)
    : DEFAULT_GUILD_SETTINGS.loopMode;

  return { volume, loopMode };
}

export function mergeSettings(base: GuildSettings, patch: Partial<GuildSettings>): GuildSettings {
  return sanitizeSettings({ ...base, ...patch });
}

export class GuildSettingsStore {
  private readonly settings = new Map<string, GuildSettings>();
  private saveTimer?: NodeJS.Timeout;

  constructor(
    private readonly filePath: string,
    private readonly debounceMs = 500,
  ) {}

  load(): void {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [guildId, value] of Object.entries(parsed)) {
        this.settings.set(guildId, sanitizeSettings(value));
      }
      logger.info({ guilds: this.settings.size, file: this.filePath }, "Guild settings loaded");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.info({ file: this.filePath }, "No guild settings file yet, starting fresh");
      } else {
        logger.warn({ err: error, file: this.filePath }, "Failed to load guild settings, using defaults");
      }
    }
  }

  get(guildId: string): GuildSettings {
    return this.settings.get(guildId) ?? { ...DEFAULT_GUILD_SETTINGS };
  }

  update(guildId: string, patch: Partial<GuildSettings>): GuildSettings {
    const next = mergeSettings(this.get(guildId), patch);
    this.settings.set(guildId, next);
    this.scheduleSave();
    return next;
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      this.save();
    }, this.debounceMs);
  }

  /** Persists immediately (atomic write). */
  save(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      const payload = JSON.stringify(Object.fromEntries(this.settings), null, 2);
      const tmp = `${this.filePath}.tmp`;
      writeFileSync(tmp, payload, "utf8");
      renameSync(tmp, this.filePath);
    } catch (error) {
      logger.warn({ err: error, file: this.filePath }, "Failed to save guild settings");
    }
  }

  /** Cancels a pending debounced save and writes now. */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
    this.save();
  }
}
