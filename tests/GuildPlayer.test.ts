import { describe, expect, it, vi } from "vitest";
import type { RequestedBy, Track } from "../src/music/Track";
import type { AudioProvider } from "../src/providers/AudioProvider";
import { GuildPlayer } from "../src/music/GuildPlayer";

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

describe("GuildPlayer", () => {
  it("starts with lastTextChannelId undefined", () => {
    const player = new GuildPlayer("guild-1", new StubProvider(), () => {});
    expect(player.lastTextChannelId).toBeUndefined();
  });

  it("stores and retrieves lastTextChannelId", () => {
    const player = new GuildPlayer("guild-1", new StubProvider(), () => {});
    player.lastTextChannelId = "channel-123";
    expect(player.lastTextChannelId).toBe("channel-123");
  });

  it("allows setting lastTextChannelId to undefined", () => {
    const player = new GuildPlayer("guild-1", new StubProvider(), () => {});
    player.lastTextChannelId = "channel-123";
    player.lastTextChannelId = undefined;
    expect(player.lastTextChannelId).toBeUndefined();
  });
});
