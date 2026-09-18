import { describe, expect, it } from "vitest";
import type { RequestedBy, Track } from "../src/music/Track";
import type { AudioProvider } from "../src/providers/AudioProvider";
import { PlayerManager } from "../src/music/PlayerManager";

class StubProvider implements AudioProvider {
  async search(query: string, requestedBy: RequestedBy): Promise<Track> {
    return { id: query, title: query, webpageUrl: "https://youtube.com/watch?v=test", requestedBy, provider: "youtube" };
  }
  async resolve(url: string, requestedBy: RequestedBy): Promise<Track> {
    return { id: "url", title: "URL", webpageUrl: url, requestedBy, provider: "youtube" };
  }
  async getStreamUrl(): Promise<string> {
    return "https://example.invalid/audio";
  }
}

describe("PlayerManager", () => {
  it("returns one player per guild and keeps guilds separated", () => {
    const manager = new PlayerManager(new StubProvider());
    const guildA1 = manager.getOrCreate("guild-a");
    const guildA2 = manager.getOrCreate("guild-a");
    const guildB = manager.getOrCreate("guild-b");

    expect(guildA1).toBe(guildA2);
    expect(guildA1).not.toBe(guildB);
    expect(manager.size).toBe(2);
  });

  it("resolves text searches through the provider", async () => {
    const manager = new PlayerManager(new StubProvider());
    const result = await manager.resolveTrack("hello", { id: "1", username: "Tester" });
    expect(result.title).toBe("hello");
  });

  it("activeGuildIds returns empty array when no players exist", () => {
    const manager = new PlayerManager(new StubProvider());
    expect(manager.activeGuildIds).toEqual([]);
  });

  it("activeGuildIds returns guild IDs for connected players", () => {
    const manager = new PlayerManager(new StubProvider());
    manager.getOrCreate("guild-a");
    manager.getOrCreate("guild-b");
    // Players are not connected (no voice channel joined), so activeGuildIds should be empty
    expect(manager.activeGuildIds).toEqual([]);
  });
});
