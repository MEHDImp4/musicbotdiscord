import { describe, expect, it } from "vitest";
import { findConflictingSession, splitSessionId, toSessionId } from "../src/music/session";

describe("session ids", () => {
  it("builds and splits a session id", () => {
    expect(toSessionId("guild", "channel")).toBe("guild:channel");
    expect(splitSessionId("guild:channel")).toEqual({ guildId: "guild", channelId: "channel" });
  });

  it("rejects malformed session ids", () => {
    expect(splitSessionId("nope")).toBeUndefined();
    expect(splitSessionId(":channel")).toBeUndefined();
    expect(splitSessionId("guild:")).toBeUndefined();
  });
});

describe("findConflictingSession", () => {
  const session = (channelId: string, isConnected = true) => ({ channelId, isConnected });

  it("returns a connected session occupying another channel", () => {
    const conflict = findConflictingSession([session("a")], "b");
    expect(conflict?.channelId).toBe("a");
  });

  it("ignores the requested channel", () => {
    expect(findConflictingSession([session("a")], "a")).toBeUndefined();
  });

  it("ignores disconnected sessions", () => {
    expect(findConflictingSession([session("a", false)], "b")).toBeUndefined();
  });

  it("returns undefined when there are no sessions", () => {
    expect(findConflictingSession([], "b")).toBeUndefined();
  });
});
