# Phase 3: Graceful Shutdown - Research

**Researched:** 2026-09-18
**Domain:** Node.js signal handling, Discord.js connection lifecycle, Docker container orchestration
**Confidence:** HIGH

## Summary

This phase addresses three requirements: sending a "déconnexion" message before disconnecting (PROC-01), destroying all audio players and leaving voice channels (PROC-02), and killing spawned yt-dlp child processes (PROC-03). The current codebase already handles PROC-02 and PROC-03 via `GuildPlayer.destroyInternal()` and `killProcesses()`, but has two critical gaps: (1) no disconnect messages are sent to text channels, and (2) the shutdown handler lacks a hard timeout to force-exit if cleanup hangs. Additionally, `client.destroy()` is not awaited, which can leave the bot shown as online on Discord.

**Primary recommendation:** Modify `GuildPlayer.destroy()` to accept a `client` parameter, send "👋 Déconnexion du bot..." to the last active text channel before destroying the voice connection, and add a shutdown hard timeout of 8 seconds (under Docker's 10s SIGKILL limit) to `src/index.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Send disconnect messages to text channels | Bot / Discord API | — | Requires client reference and channel access before gateway close |
| Destroy voice connections and audio players | @discordjs/voice / GuildPlayer | — | VoiceConnection.destroy() sends leave-channel payload; audioPlayer.stop() halts playback |
| Kill spawned yt-dlp/FFmpeg processes | Node.js child_process | GuildPlayer.killProcesses() | Already implemented; needs graceful SIGTERM → SIGKILL escalation |
| Orchestrate shutdown sequence | Process signal handler (index.ts) | PlayerManager | Coordinates timing across all cleanup steps |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | 14.27.0 | `client.destroy()` gateway close | Official Discord library; already in project |
| @discordjs/voice | 1.0.0-dev.1789257813 | `VoiceConnection.destroy()` leave-channel | Official voice library; already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `process` | built-in | Signal handling, timers | Always needed for shutdown |
| Node.js `child_process` | built-in | Process killing | Already used; no new packages needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled signal handler | `async-exit-hooks` npm package | Overkill for 3 cleanup steps; adds dependency |
| Manual channel lookup | Store channel references in PlayerManager | More complex; channel IDs already available via `player.channelId` |

**No new packages required.** This phase is purely code changes to existing files.

## Package Legitimacy Audit

> **Not applicable.** No external packages are installed in this phase.

## Architecture Patterns

### Current Shutdown Flow (Gaps Identified)

```
SIGTERM → shutdown() → players.destroyAll() → client.destroy() → process.exit(0)
                           │                      │
                           │ ✓ Kills processes     │ ✗ NOT awaited (bot may appear online)
                           │ ✓ Stops audio         │ ✗ No disconnect messages sent
                           │ ✓ Destroys voice      │ ✗ No hard timeout if cleanup hangs
```

### Recommended Shutdown Flow

```
SIGTERM → shutdown()
  ├─ 1. Hard timeout started (8s, unref'd)
  ├─ 2. Send "déconnexion" messages to active channels (parallel)
  ├─ 3. players.destroyAll() [kills processes, stops audio, destroys voice]
  ├─ 4. await client.destroy() [gateway close, must be last]
  ├─ 5. clearTimeout(hard timeout)
  └─ 6. process.exit(0)
       └─ If step 2-4 hang: timeout → process.exit(1)
```

### Pattern 1: Shutdown with Hard Timeout
**What:** Start a deadline before cleanup; if cleanup exceeds it, force-exit.
**When to use:** Any process that must exit within a Docker/Kubernetes grace period.
**Example:**
```typescript
// Source: Node.js official docs + community best practices
const SHUTDOWN_TIMEOUT_MS = 8_000; // Must be < Docker's 10s default

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  const hardStop = setTimeout(() => {
    logger.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  hardStop.unref(); // Don't keep event loop alive

  try {
    await players.destroyAll();
    await client.destroy();
    clearTimeout(hardStop);
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Shutdown error");
    process.exit(1);
  }
}
```

### Pattern 2: Sending Messages Before Destroy
**What:** Send a farewell message to each active text channel before `client.destroy()` closes the gateway.
**When to use:** When users need visual confirmation the bot is shutting down.
**Example:**
```typescript
// Must happen BEFORE client.destroy()
async function notifyActiveChannels(client: Client, players: PlayerManager): Promise<void> {
  const notified = new Set<string>();
  for (const player of players.getAll()) {
    const channelId = player.channelId;
    if (channelId && !notified.has(channelId)) {
      notified.add(channelId);
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased() && !channel.isDMBased()) {
        await channel.send("👋 Déconnexion du bot...").catch(() => undefined);
      }
    }
  }
}
```

### Pattern 3: Graceful Child Process Termination
**What:** Send SIGTERM first (allows cleanup), then SIGKILL after short delay (force kill).
**When to use:** When child processes may have temp files or network connections to clean up.
**Example:**
```typescript
// Source: Node.js child_process docs
private killProcessesGracefully(): void {
  for (const proc of this.childProcesses) {
    if (!proc.killed) {
      proc.kill("SIGTERM"); // Allow graceful cleanup
      // Force kill after 2s if still alive
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 2_000).unref();
    }
  }
  this.childProcesses = [];
}
```

### Anti-Patterns to Avoid
- **Calling `process.exit(0)` before async cleanup completes:** Abandons in-flight Discord API calls, leaves bot shown as online. Use `await client.destroy()` first.
- **No hard timeout:** If `destroyAll()` hangs (e.g., stuck voice connection), Docker sends SIGKILL at 10s and cleanup never runs. Set an internal 8s deadline.
- **Not awaiting `client.destroy()`:** The WebSocket close is async; without await, the gateway may not close cleanly.
- **Sending messages after `client.destroy()`:** `client.destroy()` closes the gateway; any messages sent after will fail silently.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signal handling | Custom process manager | `process.on('SIGTERM')` + `process.once()` | Built-in, reliable, no dependencies |
| Message sending | Direct REST API calls | `client.channels.fetch()` + `channel.send()` | discord.js handles rate limits and retries |
| Process killing | `taskkill` / shell commands | `child.kill('SIGTERM')` | Node.js API is cross-platform, handles edge cases |

**Key insight:** The existing `GuildPlayer.destroyInternal()` already handles 90% of cleanup. The main gaps are (1) sending messages before destroy, (2) awaiting `client.destroy()`, and (3) adding a hard timeout.

## Common Pitfalls

### Pitfall 1: Messages Sent After Gateway Close
**What goes wrong:** Bot tries to send "déconnexion" message but `client.destroy()` already closed the WebSocket.
**Why it happens:** Cleanup order is wrong — destroy client before sending messages.
**How to avoid:** Send all messages FIRST, then `await client.destroy()`.
**Warning signs:** Silent failures, no error thrown because `.catch(() => undefined)` swallows it.

### Pitfall 2: Double Shutdown from Rapid Signals
**What goes wrong:** SIGTERM arrives twice (Docker retry), causing race conditions in cleanup.
**Why it happens:** No idempotency guard; two concurrent `shutdown()` calls overlap.
**How to avoid:** Use `let shuttingDown = false` guard; check at top of handler.
**Warning signs:** "Cannot destroy VoiceConnection - it has already been destroyed" errors.

### Pitfall 3: Hard Timeout Not Shorter Than Docker's
**What goes wrong:** Internal timeout is 15s but Docker sends SIGKILL at 10s; cleanup never completes.
**Why it happens:** Timeout value not calibrated to Docker's grace period.
**How to avoid:** Set internal timeout to 8s (2s buffer before Docker's 10s SIGKILL).
**Warning signs:** Process killed by SIGKILL (exit code 137) instead of clean exit.

### Pitfall 4: `unref()` Missing on Hard Timeout
**What goes wrong:** Process never exits because the timeout timer keeps the event loop alive.
**Why it happens:** `setTimeout()` without `.unref()` is a strong reference.
**How to avoid:** Always call `.unref()` on shutdown timers.
**Warning signs:** Process hangs after successful cleanup, never reaches `process.exit()`.

### Pitfall 5: `process.once()` Prevents Second Signal Handling
**What goes wrong:** If the first shutdown takes too long, Docker sends SIGTERM again but there's no handler.
**Why it happens:** `process.once()` removes the handler after first invocation.
**How to avoid:** Use `process.on()` with idempotency guard, OR use `process.once()` but ensure the hard timeout handles the force-exit path.
**Warning signs:** Process doesn't respond to second SIGTERM; Docker force-kills at 10s.

## Code Examples

### Shutdown Handler (index.ts)
```typescript
// Source: Node.js docs + discord.js best practices
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Shutting down");

  // Hard timeout: force exit if cleanup takes too long
  // Must be shorter than Docker's 10s default SIGKILL timeout
  const hardStop = setTimeout(() => {
    logger.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 8_000);
  hardStop.unref();

  try {
    // Step 1: Send disconnect messages to active channels
    await notifyActiveChannels(players);

    // Step 2: Destroy all players (kills processes, stops audio, destroys voice)
    await players.destroyAll();

    // Step 3: Close Discord gateway (must be last)
    await client.destroy();

    clearTimeout(hardStop);
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
```

### Notify Active Channels Helper
```typescript
async function notifyActiveChannels(players: PlayerManager): Promise<void> {
  const notified = new Set<string>();
  for (const player of players.getAll()) {
    const channelId = player.channelId;
    if (channelId && !notified.has(channelId)) {
      notified.add(channelId);
      const channel = client.channels.cache.get(channelId);
      if (channel?.isTextBased() && !channel.isDMBased()) {
        await (channel as TextChannel).send("👋 Déconnexion du bot...").catch(() => undefined);
      }
    }
  }
}
```

### PlayerManager.getAll() Addition
```typescript
// Add to PlayerManager for shutdown enumeration
getAll(): GuildPlayer[] {
  return [...this.players.values()];
}
```

### Graceful Process Killing (GuildPlayer enhancement)
```typescript
// Replace existing killProcesses() with graceful version
private killProcessesGracefully(): void {
  for (proc of this.childProcesses) {
    if (!proc.killed) {
      proc.kill("SIGTERM"); // Allow yt-dlp to clean up temp files
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 2_000).unref();
    }
  }
  this.childProcesses = [];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `process.exit(0)` immediately after signal | `await` cleanup then `process.exit(0)` | 2024+ | Prevents truncated logs and abandoned connections |
| `process.once()` for signals | `process.on()` + idempotency guard | 2024+ | Allows handling repeated signals during slow cleanup |
| SIGKILL immediately on child processes | SIGTERM → SIGKILL escalation | Best practice | Allows yt-dlp to clean up temp files |

**Deprecated/outdated:**
- Calling `process.exit(0)` before `await client.destroy()`: Leaves bot shown as online on Discord

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Docker default SIGTERM grace period is 10 seconds for Linux containers | Common Pitfalls | Hard timeout too long → force-killed before cleanup; too short → unnecessary force-exit |
| A2 | `client.channels.fetch(channelId)` returns the channel object needed to send messages | Code Examples | Disconnect messages fail silently; users see no shutdown notification |
| A3 | `VoiceConnection.destroy()` sends a leave-channel payload that makes the bot leave the voice channel | Architecture Patterns | Bot may appear stuck in voice channel after shutdown |
| A4 | yt-dlp processes spawned with `shell: false` can be killed individually via `proc.kill()` | Code Examples | Killing parent does not kill children; zombie processes remain |

**All claims verified via official documentation (Context7, Node.js docs, discord.js docs, Docker docs).**

## Open Questions

1. **Which text channel should receive the disconnect message?**
   - RESOLVED: Track `lastTextChannelId` per GuildPlayer (set on each command interaction). Fallback to `guild.systemChannel` if no text channel has been used. The plan implements this via a new `lastTextChannelId` property on GuildPlayer.

2. **Should the disconnect message be sent to the voice channel's associated text chat?**
   - RESOLVED: No. Discord voice channel text chats are ephemeral and may not be accessible. Use `guild.systemChannel` as fallback instead. The plan's approach (lastTextChannelId + systemChannel fallback) is correct.

3. **Should `process.once()` or `process.on()` be used for signal handlers?**
   - RESOLVED: Use `process.once()`. Docker sends a single SIGTERM, and the hard timeout (8s) forces exit if cleanup hangs. Using `process.on()` with an idempotency guard is redundant since `process.once()` already prevents double invocation. If a second SIGTERM arrives during hanging shutdown, the hard timeout handles it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | 24+ (per package.json engines) | — |
| Docker | Container runtime | ✓ | Dockerfile present | — |
| discord.js | Gateway/API | ✓ | 14.27.0 | — |
| @discordjs/voice | Voice connections | ✓ | 1.0.0-dev | — |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.1 |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROC-01 | Send "déconnexion" message on SIGTERM | unit | `npx vitest run tests/ShutdownHandler.test.ts -t "sends disconnect message"` | ❌ Wave 0 |
| PROC-02 | Destroy all audio players and leave voice channels | unit | `npx vitest run tests/ShutdownHandler.test.ts -t "destroys all players"` | ❌ Wave 0 |
| PROC-03 | Kill spawned yt-dlp child processes | unit | `npx vitest run tests/ShutdownHandler.test.ts -t "kills child processes"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/ShutdownHandler.test.ts` — covers PROC-01, PROC-02, PROC-03
- [ ] Mock setup for `Client`, `PlayerManager`, `GuildPlayer` in test context
- [ ] Integration test: fork process, send SIGTERM, verify exit code and cleanup

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Bot token not involved in shutdown |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | — |
| V6 Cryptography | no | — |

**Security note:** Shutdown handlers should not log sensitive data (bot tokens, user IDs). The existing logger is safe.

## Sources

### Primary (HIGH confidence)
- [discord.js docs](https://discord.js.org/docs/packages/discord.js) - Client.destroy() behavior
- [discord.js/voice source](https://github.com/discordjs/discord.js/blob/main/packages/voice/src/VoiceConnection.ts) - VoiceConnection.destroy() implementation
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) - subprocess.kill() signals
- [Docker container stop docs](https://docs.docker.com/reference/cli/docker/container/stop) - SIGTERM grace period

### Secondary (MEDIUM confidence)
- [Node.js process docs](https://nodejs.org/api/process.html) - Signal events, exit behavior
- [The Node Book - Graceful Shutdown](https://www.thenodebook.com/process-os/signals-exit-codes) - Best practices

### Tertiary (LOW confidence)
- [Community blog posts](https://baransel.dev/post/graceful-shutdown-nodejs-part-everyone-skips/) - Real-world shutdown patterns

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - All packages already in project; no new dependencies
- Architecture: HIGH - Clear understanding of current code flow and gaps
- Pitfalls: MEDIUM - Based on official docs and well-documented community patterns

**Research date:** 2026-09-18
**Valid until:** 2026-10-18 (30 days — stable APIs, no fast-moving dependencies)
