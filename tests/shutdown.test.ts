import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createShutdown, type ShutdownDeps } from "../src/shutdown";

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockPlayerManager(activeGuildIds: string[] = []) {
  return {
    activeGuildIds,
    destroyAll: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockReturnValue(null),
  };
}

function createMockClient() {
  return {
    guilds: {
      fetch: vi.fn().mockResolvedValue({
        id: "guild-1",
        systemChannel: {
          send: vi.fn().mockResolvedValue(undefined),
          isTextBased: () => true,
          isDMBased: () => false,
        },
      }),
    },
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

describe("shutdown", () => {
  let originalExit: typeof process.exit;

  beforeEach(() => {
    originalExit = process.exit;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it("sends disconnect messages to active guilds", async () => {
    const logger = createMockLogger();
    const players = createMockPlayerManager(["guild-1"]);
    const client = createMockClient();

    const shutdown = createShutdown({ client: client as any, players: players as any, logger: logger as any });
    const exitMock = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await shutdown("SIGTERM");

    expect(client.guilds.fetch).toHaveBeenCalledWith("guild-1");
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("falls back to systemChannel when no lastTextChannelId", async () => {
    const logger = createMockLogger();
    const players = createMockPlayerManager(["guild-1"]);
    const systemChannel = {
      send: vi.fn().mockResolvedValue(undefined),
      isTextBased: () => true,
      isDMBased: () => false,
    };
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: "guild-1",
          systemChannel,
        }),
      },
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    const shutdown = createShutdown({ client: client as any, players: players as any, logger: logger as any });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await shutdown("SIGTERM");

    expect(systemChannel.send).toHaveBeenCalledWith("ℹ️ Déconnexion du bot...");
  });

  it("handles send failure gracefully", async () => {
    const logger = createMockLogger();
    const players = createMockPlayerManager(["guild-1"]);
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          id: "guild-1",
          systemChannel: {
            send: vi.fn().mockRejectedValue(new Error("Send failed")),
            isTextBased: () => true,
            isDMBased: () => false,
          },
        }),
      },
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    const shutdown = createShutdown({ client: client as any, players: players as any, logger: logger as any });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await shutdown("SIGTERM");

    // Should still destroy players and client even if send fails
    expect(players.destroyAll).toHaveBeenCalled();
    expect(client.destroy).toHaveBeenCalled();
  });

  it("awaits client.destroy()", async () => {
    const logger = createMockLogger();
    const players = createMockPlayerManager([]);
    const destroyMock = vi.fn().mockResolvedValue(undefined);
    const client = {
      guilds: { fetch: vi.fn() },
      destroy: destroyMock,
    };

    const shutdown = createShutdown({ client: client as any, players: players as any, logger: logger as any });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await shutdown("SIGTERM");

    expect(destroyMock).toHaveBeenCalled();
  });

  it("is idempotent - calling twice does not send messages or destroy twice", async () => {
    const logger = createMockLogger();
    const players = createMockPlayerManager(["guild-1"]);
    const client = createMockClient();

    const shutdown = createShutdown({ client: client as any, players: players as any, logger: logger as any });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await shutdown("SIGTERM");
    await shutdown("SIGTERM");

    // Should only destroy once
    expect(players.destroyAll).toHaveBeenCalledTimes(1);
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  it("sends no messages if no active guilds", async () => {
    const logger = createMockLogger();
    const players = createMockPlayerManager([]);
    const client = createMockClient();

    const shutdown = createShutdown({ client: client as any, players: players as any, logger: logger as any });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await shutdown("SIGTERM");

    expect(client.guilds.fetch).not.toHaveBeenCalled();
  });
});
