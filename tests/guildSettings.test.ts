import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GUILD_SETTINGS,
  GuildSettingsStore,
  mergeSettings,
  sanitizeSettings,
} from "../src/music/GuildSettingsStore";

describe("sanitizeSettings", () => {
  it("keeps valid values", () => {
    expect(sanitizeSettings({ volume: 30, loopMode: "track" })).toEqual({ volume: 30, loopMode: "track" });
  });

  it("clamps and rounds the volume", () => {
    expect(sanitizeSettings({ volume: 250 }).volume).toBe(100);
    expect(sanitizeSettings({ volume: -10 }).volume).toBe(0);
    expect(sanitizeSettings({ volume: 42.6 }).volume).toBe(43);
  });

  it("falls back to defaults for invalid input", () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_GUILD_SETTINGS);
    expect(sanitizeSettings({ volume: "loud", loopMode: "nope" })).toEqual(DEFAULT_GUILD_SETTINGS);
  });
});

describe("mergeSettings", () => {
  it("updates only the provided field", () => {
    expect(mergeSettings({ volume: 20, loopMode: "off" }, { loopMode: "queue" })).toEqual({
      volume: 20,
      loopMode: "queue",
    });
  });
});

describe("GuildSettingsStore", () => {
  const dirs: string[] = [];

  function tempFile(): string {
    const dir = mkdtempSync(join(tmpdir(), "pulse-settings-"));
    dirs.push(dir);
    return join(dir, "guild-settings.json");
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("returns defaults for unknown guilds", () => {
    const store = new GuildSettingsStore(tempFile(), 0);
    expect(store.get("g1")).toEqual(DEFAULT_GUILD_SETTINGS);
  });

  it("persists and reloads settings", () => {
    const file = tempFile();
    const store = new GuildSettingsStore(file, 0);
    store.update("g1", { volume: 35 });
    store.update("g1", { loopMode: "queue" });
    store.flush();

    const reloaded = new GuildSettingsStore(file, 0);
    reloaded.load();
    expect(reloaded.get("g1")).toEqual({ volume: 35, loopMode: "queue" });
  });

  it("recovers from a corrupt file using defaults", () => {
    const file = tempFile();
    writeFileSync(file, "{ not valid json", "utf8");
    const store = new GuildSettingsStore(file, 0);
    store.load();
    expect(store.get("g1")).toEqual(DEFAULT_GUILD_SETTINGS);
  });
});
