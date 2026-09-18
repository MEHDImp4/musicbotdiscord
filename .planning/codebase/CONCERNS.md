# Codebase Concerns

**Analysis Date:** 2026-09-18

## Tech Debt

**Unused configuration — `maxStreamRetries`:**
- Issue: `MAX_STREAM_RETRIES` is parsed in `src/config/env.ts:26` but never referenced anywhere in the codebase. Retry logic was never implemented.
- Files: `src/config/env.ts`
- Impact: Misleads future developers into thinking retry is handled; stream failures are not retried at all.
- Fix approach: Either implement retry logic in `src/audio/AudioPipeline.ts` or remove the env var from `src/config/env.ts:26`.

**Monolithic command file:**
- Issue: All 10 commands are defined in a single 263-line file (`src/commands/index.ts`) with shared helper functions. There is no file-per-command pattern or command loader.
- Files: `src/commands/index.ts`
- Impact: Adding a new command requires editing the same large file; commands can't be independently reasoned about; imports grow for each new dependency.
- Fix approach: Extract each command into `src/commands/<name>.ts` and use a directory-based loader pattern. Keep `CommandDefinition` interface in a shared `src/commands/types.ts`.

**CommonJS module system on Node 24+:**
- Issue: `tsconfig.json` uses `"module": "CommonJS"` and `"moduleResolution": "Node"` despite requiring Node >= 24.17.0, which has mature ESM support.
- Files: `tsconfig.json`
- Impact: Misses ESM-only package compatibility, tree-shaking benefits, and `--experimental-require-module` is a runtime shim, not a proper solution.
- Fix approach: Migrate to `"module": "Node16"` or `"module": "NodeNext"` with ESM output. Update `package.json` with `"type": "module"`.

**Dev-version pinned dependency:**
- Issue: `@discordjs/voice` is pinned to `1.0.0-dev.1789257813-c626815bf` — a development/pre-release build. This may contain breaking changes, bugs, or be yanked from npm.
- Files: `package.json:21`
- Impact: Production stability risk; difficult to get support for pre-release versions; may break on reinstall if the version is unpublished.
- Fix approach: Monitor for stable `1.0.0` release. Pin the exact commit hash or use a published stable version when available.

## Known Bugs

**Test stub doesn't match interface:**
- Symptoms: `StubProvider` in tests implements `getStreamUrl()` which is not part of the `AudioProvider` interface. The actual required method is `createReadStream()`.
- Files: `tests/PlayerManager.test.ts:13-15`
- Trigger: Running `npm test` — the test still passes because `resolveTrack` never calls `createReadStream`, but the stub is misleading and tests would fail if integration-level tests were added.
- Workaround: N/A — tests pass by coincidence. Fix by replacing `getStreamUrl()` with `createReadStream()` in the stub.

**Queue position semantics:**
- Symptoms: `QueueManager.enqueue()` returns `this.tracks.length` after pushing, so the first track in queue returns position `1`. This works for user-facing display ("position #1") but the internal contract is ambiguous.
- Files: `src/music/QueueManager.ts:12-13`
- Trigger: Any code reading the returned position as a zero-based index will be off-by-one.
- Workaround: Document that the return value is 1-based user-facing position, not an index.

## Security Considerations

**No rate limiting on commands:**
- Risk: Any user in a guild can spam `/play` commands, spawning unbounded yt-dlp + FFmpeg process chains per request.
- Files: `src/commands/index.ts`, `src/music/GuildPlayer.ts`
- Current mitigation: `MAX_QUEUE_SIZE` (default 100) limits queue depth per guild, but doesn't prevent process spawn flooding.
- Recommendations: Add per-user command cooldown (e.g., 2 seconds between `/play` invocations) or rate-limit at the `PlayerManager` level.

**Piped-error swallowing in interaction handlers:**
- Risk: `.catch(() => undefined)` on lines 36, 38, 54, 56 of `src/index.ts` silently swallows Discord API errors when sending error responses to users.
- Files: `src/index.ts:36,38,54,56`
- Current mitigation: Prevents unhandled promise rejections but also hides failures (e.g., missing permissions, rate limits).
- Recommendations: Log these silenced errors at warn level: `.catch((err) => logger.warn({ err }, "Failed to send error reply"))`.

**Dockerfile pip `--break-system-packages`:**
- Risk: The Dockerfile uses `pip3 install --break-system-packages` which bypasses Python's externally-managed environment protection.
- Files: `Dockerfile:5`
- Current mitigation: Acceptable in a container context (isolated environment), but sets a bad precedent.
- Recommendations: Use a virtual environment (`python3 -m venv /opt/venv`) instead of `--break-system-packages`.

**Log files in repository root:**
- Risk: `bot.err`, `bot.log`, `bot_error.log`, `bot_output.log` exist in the repo root. While gitignored, they may be accidentally committed or contain sensitive data from runtime.
- Files: `bot.err`, `bot.log`, `bot_error.log`, `bot_output.log` (repo root)
- Current mitigation: `.gitignore` includes `*.log`.
- Recommendations: Add `bot.err` to `.gitignore` (not covered by `*.log` pattern). Consider using a `logs/` directory instead.

## Performance Bottlenecks

**`Array.shift()` in queue dequeue:**
- Problem: `QueueManager.dequeue()` uses `this.tracks.shift()` which is O(n) because it reindexes the entire array.
- Files: `src/music/QueueManager.ts:16-18`
- Cause: Simple implementation choice.
- Improvement path: Use a circular buffer or linked list for O(1) dequeue. With a max queue of 100 the impact is minor, but it becomes significant if `MAX_QUEUE_SIZE` is increased.

**Per-request yt-dlp process spawn:**
- Problem: Every `/play` search and every track stream resolution spawns a new yt-dlp child process. On a busy guild this creates significant process overhead.
- Files: `src/providers/YouTubeProvider.ts:56-70,82-86,122-136`
- Cause: yt-dlp is a CLI tool, not a library — there's no persistent connection.
- Improvement path: For search, consider caching recent search results. For streaming, the current approach (resolve just-in-time) is correct to avoid URL expiry. Process spawn overhead is inherent to the yt-dlp CLI approach.

**Full queue copy on every `/queue` invocation:**
- Problem: `QueueManager.snapshot()` creates a shallow copy of the entire tracks array every time the queue embed is rendered.
- Files: `src/music/QueueManager.ts:24-26`, `src/ui/embeds.ts:21`
- Cause: Defensive copy to prevent mutation during iteration.
- Improvement path: Acceptable for queues under ~100 items. If queue size grows, consider a read-only view or paginated queue display.

## Fragile Areas

**`runExclusive()` promise serialization:**
- Files: `src/music/GuildPlayer.ts:386-390`
- Why fragile: All player operations are serialized through a single promise chain. If an operation throws unexpectedly or hangs, subsequent operations queue behind it indefinitely. There is no timeout or deadlock detection.
- Safe modification: Never add blocking I/O inside `runExclusive()`. Keep operations fast. Consider adding a per-operation timeout.
- Test coverage: None — no tests exercise `GuildPlayer` directly.

**`killProcesses()` uses `SIGKILL`:**
- Files: `src/music/GuildPlayer.ts:361-366`
- Why fragile: `SIGKILL` (SIGKILL on Windows is `process.kill('SIGKILL')` which maps to TerminateProcess) doesn't allow yt-dlp or FFmpeg to clean up temp files or flush buffers. This can leave orphaned temp files on some OS configurations.
- Safe modification: Try `SIGTERM` first with a short grace period, then fall back to `SIGKILL`. On Windows, `SIGTERM` and `SIGKILL` both map to TerminateProcess, so the distinction only matters on Linux.
- Test coverage: None.

**Voice connection state not reset on failed `connect()`:**
- Files: `src/music/GuildPlayer.ts:166-171`
- Why fragile: If `entersState()` throws, the connection is destroyed and set to `undefined`, but `_state` is set to `"ERROR"`. There's no automatic recovery from `"ERROR"` state — the player must be manually retried by the user.
- Safe modification: Consider auto-recovering to `"IDLE"` after a short delay, or clearly communicate to users that they should try again.
- Test coverage: None.

**`playNextInternal()` recursion on track failure:**
- Files: `src/music/GuildPlayer.ts:297-311`
- Why fragile: If every track in the queue fails to start, `playNextInternal()` recursively calls itself for each failure. With a large queue of unplayable tracks, this could overflow the stack.
- Safe modification: Convert to iterative loop or add a maximum consecutive failure counter.
- Test coverage: None.

**No runtime health check for external tools:**
- Files: `src/providers/YouTubeProvider.ts`, `src/audio/AudioPipeline.ts`
- Why fragile: If `yt-dlp` or `ffmpeg` are removed from `PATH` at runtime, the bot crashes with an unhelpful `ENOENT` error on the first play attempt.
- Safe modification: Validate tool availability at startup (in `src/index.ts` after env load) and log a clear warning.
- Test coverage: None.

## Scaling Limits

**Per-guild `GuildPlayer` memory:**
- Current capacity: One `GuildPlayer` per guild, each holding a `QueueManager` (array of Track objects), `AudioPlayer`, and potentially spawned child processes.
- Limit: Memory grows linearly with guild count. Each guild's player is kept alive by idle/empty-channel timers (default 300s + 60s).
- Scaling path: For >50 concurrent guilds, consider a shared process pool for yt-dlp/FFmpeg and more aggressive idle cleanup.

**No horizontal scaling support:**
- Current capacity: Single-process Node.js instance. `PlayerManager` is an in-memory `Map<string, GuildPlayer>`.
- Limit: Cannot run multiple bot instances for the same Discord application without a shared state layer.
- Scaling path: If multi-instance is needed, add Redis-backed state sharing or use Lavalink for externalized audio processing.

## Dependencies at Risk

**`@discordjs/voice` dev build:**
- Risk: Pinned to `1.0.0-dev.1789257813-c626815bf`. Pre-release builds may be unpublished, contain bugs, or have API changes without notice.
- Impact: Core audio functionality breaks on reinstall or if npm unpublishes the version.
- Migration plan: Switch to stable release when available. Track `@discordjs/voice` releases. Consider `@discordjs/voice@^1.0.0` when stable.

**`@discordjs/opus` exact pin:**
- Risk: Pinned to `0.10.0` exactly. Native addon — may not compile on newer Node.js versions without an update.
- Impact: `npm install` fails on unsupported platforms/Node versions.
- Migration plan: Test with `^0.10.0` to allow patch updates. Monitor `@discordjs/opus` releases for Node 24 compatibility.

## Missing Critical Features

**No stream retry mechanism:**
- Problem: `env.maxStreamRetries` is configured but no retry logic exists. A single transient yt-dlp failure (network hiccup, YouTube rate limit) skips the track immediately.
- Blocks: Reliable playback in production. Users experience skipped tracks on any transient failure.

**No startup validation of external tools:**
- Problem: The bot doesn't verify that `yt-dlp` and `ffmpeg` are available in `PATH` until the first `/play` command.
- Blocks: Early failure detection. Operators can't confirm readiness from logs alone.

**No graceful shutdown of child processes:**
- Problem: `shutdown()` in `src/index.ts:74-78` calls `players.destroyAll()` which calls `killProcesses()` with `SIGKILL`. There's no opportunity for yt-dlp/FFmpeg to flush or clean up.
- Blocks: Clean deployments. Container stop signals may leave zombie processes briefly.

## Test Coverage Gaps

**Untested: `GuildPlayer` lifecycle:**
- What's not tested: Connection, disconnection, idle timeout, empty-channel timeout, skip, stop, play-next sequencing, error recovery.
- Files: `src/music/GuildPlayer.ts` (391 lines, 0% test coverage)
- Risk: Regressions in core playback logic go undetected. The `runExclusive()` serialization pattern is particularly error-prone without tests.
- Priority: High

**Untested: `AudioPipeline` streaming:**
- What's not tested: FFmpeg process spawn, stream piping, error propagation, process cleanup.
- Files: `src/audio/AudioPipeline.ts` (89 lines, 0% test coverage)
- Risk: Stream failures cause audio dropouts with no automated detection.
- Priority: High

**Untested: `YouTubeProvider` external process interaction:**
- What's not tested: yt-dlp metadata fetching, URL validation, stream creation, error handling.
- Files: `src/providers/YouTubeProvider.ts` (137 lines, 0% test coverage)
- Risk: yt-dlp output format changes break track resolution silently.
- Priority: Medium

**Untested: Command handlers:**
- What's not tested: Any slash command execution flow.
- Files: `src/commands/index.ts` (263 lines, 0% test coverage)
- Risk: Interaction handling bugs (permission checks, defer/reply race conditions) go undetected.
- Priority: Medium

**Test stub mismatch:**
- What's not tested: `StubProvider` implements `getStreamUrl()` instead of `createReadStream()`, making the stub non-conformant to the `AudioProvider` interface.
- Files: `tests/PlayerManager.test.ts:6-16`
- Risk: Tests pass but don't validate the real interface contract. Any future test calling `createReadStream` on the stub would get `undefined`.
- Priority: Low

---

*Concerns audit: 2026-09-18*
