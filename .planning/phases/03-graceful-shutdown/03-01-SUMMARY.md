---
phase: 03-graceful-shutdown
plan: 01
status: complete
completed_at: "2026-09-18T16:53:00.000Z"
requirements_completed:
  - PROC-01
  - PROC-02
  - PROC-03
files_modified:
  - src/index.ts
  - src/music/GuildPlayer.ts
  - src/music/PlayerManager.ts
  - src/shutdown.ts
files_created:
  - tests/GuildPlayer.test.ts
  - tests/shutdown.test.ts
commits:
  - hash: pending
    message: "feat(shutdown): add graceful shutdown with disconnect messages and SIGTERM escalation"
---

# Phase 3 Summary: Graceful Shutdown

## What Was Done

### Task 1: Add text channel tracking and active guilds getter
- Added `lastTextChannelId` property to GuildPlayer (getter/setter)
- Cleared `lastTextChannelId` in `destroyInternal()`
- Added `activeGuildIds` getter to PlayerManager
- Created `tests/GuildPlayer.test.ts` with 3 tests

### Task 2: Create shutdown module
- Created `src/shutdown.ts` with `createShutdown` factory function
- Sends "ℹ️ Déconnexion du bot..." to active guild text channels before shutdown
- Falls back to `guild.systemChannel` if no `lastTextChannelId` set
- Uses `Promise.allSettled` for concurrent message sending
- Awaits `client.destroy()` for clean WebSocket close
- Enforces 8-second hard timeout via `process.exit(1)`
- Idempotent (safe for double SIGTERM)
- Created `tests/shutdown.test.ts` with 6 tests

### Task 3: Implement SIGTERM→SIGKILL escalation
- Modified `killProcesses()` to be async
- Sends SIGTERM first, waits 1 second for graceful exit
- Escalates to SIGKILL if process doesn't exit within grace period
- Updated all 6 callers to await the method
- Processes that exit promptly never receive SIGKILL

## Requirements Satisfied

| Requirement | Status | Evidence |
|-------------|--------|----------|
| PROC-01 | ✅ | Disconnect message sent to active guilds before shutdown |
| PROC-02 | ✅ | `players.destroyAll()` called in shutdown sequence |
| PROC-03 | ✅ | SIGTERM→SIGKILL escalation in `killProcesses()` |

## Key Design Decisions

- **`createShutdown` factory** — avoids circular imports, makes shutdown testable
- **`lastTextChannelId`** — tracks where commands were last used; fallback to `guild.systemChannel`
- **8s hard timeout** — below Docker's 15s `stop_grace_period`, forces `process.exit(1)` if cleanup hangs
- **`process.once()`** — Docker sends single SIGTERM; hard timeout handles edge cases

## Verification Commands

```bash
# Run all tests
npm test

# Build project
npm run build

# Manual verification: send SIGTERM, verify disconnect message appears
# Bot should go offline immediately (not after 45s heartbeat timeout)
```

## Regression Check
- `npm test` — 16 tests passed, 0 failed
- `npm run build` — TypeScript compilation successful
