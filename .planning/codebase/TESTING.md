# Testing Patterns

**Analysis Date:** 2026-09-18

## Test Framework

**Runner:**
- Vitest 5.0.1
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`, `toBe`, `toThrow`)

**Run Commands:**
```bash
npm test                # vitest run — single pass
npm run test:watch      # vitest — watch mode
```

## Test File Organization

**Location:**
- Separate `tests/` directory at project root (not co-located with source)

**Naming:**
- `*.test.ts` suffix: `QueueManager.test.ts`, `PlayerManager.test.ts`
- Test file names match the class/module under test

**Structure:**
```
tests/
├── setup.ts                    # Global test setup (env var stubs)
├── QueueManager.test.ts        # Unit tests for QueueManager class
└── PlayerManager.test.ts       # Unit tests for PlayerManager class
```

## Test Setup

**Global Setup:**
- `tests/setup.ts` — configured in `vitest.config.ts` via `setupFiles`
- Stubs required env vars so tests run without a real bot token:

```typescript
process.env.DISCORD_TOKEN ??= "test-token";
process.env.DISCORD_CLIENT_ID ??= "test-client";
process.env.IDLE_TIMEOUT_SECONDS ??= "1";
process.env.EMPTY_CHANNEL_TIMEOUT_SECONDS ??= "1";
```

**Environment:**
- Node environment (`environment: "node"` in vitest config)
- No browser or DOM dependencies

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from "vitest";
import { QueueManager } from "../src/music/QueueManager";
import type { Track } from "../src/music/Track";

describe("QueueManager", () => {
  it("keeps FIFO order", () => {
    // Arrange, Act, Assert inline
  });

  it("clears the queue", () => {
    // ...
  });

  it("enforces maximum size", () => {
    // ...
  });
});
```

**Patterns:**
- `describe()` blocks group tests by class/module
- `it()` blocks for individual test cases with descriptive names
- No `beforeEach`/`afterEach` — each test is self-contained
- No `beforeAll`/`afterAll` — no shared expensive setup
- Tests are pure unit tests — no external dependencies

## Mocking

**Framework:**
- None — tests use hand-written stubs and fakes

**Patterns:**
- Stub classes implementing interfaces:

```typescript
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
```

- Factory functions for test data:

```typescript
function track(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    webpageUrl: `https://youtube.com/watch?v=${id}`,
    requestedBy: { id: "user", username: "Tester" },
    provider: "youtube",
  };
}
```

**What to Mock:**
- External providers (AudioProvider interface) — never call real yt-dlp in tests
- Discord.js client/interactions — not currently tested (would require mocking)

**What NOT to Mock:**
- Internal classes under test (QueueManager, PlayerManager) — test real implementations
- Data structures (Track interface) — use real objects

## Fixtures and Factories

**Test Data:**
- Factory functions defined at top of test file (see `track()` above)
- Inline object literals for simple cases
- No fixture files or shared test data directory

**Location:**
- Factory functions colocated in test files, not shared

## Coverage

**Requirements:** None enforced — no coverage threshold configured

**View Coverage:**
```bash
npx vitest run --coverage    # If @vitest/coverage is installed (currently not in dependencies)
```

Note: `@vitest/coverage` is not in `devDependencies`. Coverage reporting would need to be added.

## Test Types

**Unit Tests:**
- Scope: Individual classes in isolation
- Approach: Create instances with stub dependencies, verify behavior
- Examples:
  - `QueueManager.test.ts` — FIFO ordering, max size enforcement, clear behavior
  - `PlayerManager.test.ts` — Guild isolation, player creation/reuse, search delegation

**Integration Tests:**
- Not present — no tests exercise multiple modules together
- No tests for voice connection, audio playback, or Discord API interaction

**E2E Tests:**
- Not used — no bot integration tests

## Common Patterns

**Async Testing:**
```typescript
it("resolves text searches through the provider", async () => {
  const manager = new PlayerManager(new StubProvider());
  const result = await manager.resolveTrack("hello", { id: "1", username: "Tester" });
  expect(result.title).toBe("hello");
});
```

**Error Testing:**
```typescript
it("enforces maximum size", () => {
  const queue = new QueueManager(1);
  queue.enqueue(track("a"));
  expect(() => queue.enqueue(track("b"))).toThrow(/Queue limit reached/);
});
```

**Identity/Reference Testing:**
```typescript
it("returns one player per guild and keeps guilds separated", () => {
  const manager = new PlayerManager(new StubProvider());
  const guildA1 = manager.getOrCreate("guild-a");
  const guildA2 = manager.getOrCreate("guild-a");
  const guildB = manager.getOrCreate("guild-b");

  expect(guildA1).toBe(guildA2);       // Same reference
  expect(guildA1).not.toBe(guildB);    // Different reference
  expect(manager.size).toBe(2);
});
```

## Test Gaps

**Untested Modules:**
- `src/index.ts` — bot entry point, event wiring
- `src/commands/index.ts` — all command implementations (263 lines)
- `src/interactions/musicControls.ts` — button interaction handler
- `src/providers/YouTubeProvider.ts` — yt-dlp integration
- `src/audio/AudioPipeline.ts` — FFmpeg pipeline
- `src/ui/embeds.ts` — embed builders
- `src/ui/controls.ts` — button builders
- `src/utils/process.ts` — process spawning utility
- `src/utils/time.ts` — duration formatting
- `src/config/env.ts` — environment variable parsing
- `src/music/GuildPlayer.ts` — core player logic (391 lines, largest file)
- `src/music/PlayerState.ts` — type definition only

**Priority Areas for Testing:**
1. `src/utils/time.ts` — pure function, easy to test
2. `src/config/env.ts` — validation logic, critical for startup
3. `src/utils/process.ts` — process spawning with timeout/output limits
4. `src/commands/index.ts` — command validation and error paths
5. `src/music/GuildPlayer.ts` — state machine logic (complex, high-value)

---

*Testing analysis: 2026-09-18*
