---
phase: 03-graceful-shutdown
---

# Validation: Phase 3 — Graceful Shutdown

## Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 5.0.1 |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROC-01 | Send "déconnexion" message on SIGTERM | unit | `npx vitest run tests/shutdown.test.ts -t "sends disconnect message"` | ❌ Wave 0 |
| PROC-02 | Destroy all audio players and leave voice channels | unit | `npx vitest run tests/shutdown.test.ts -t "destroys all players"` | ❌ Wave 0 |
| PROC-03 | Kill spawned yt-dlp child processes | unit | `npx vitest run tests/shutdown.test.ts -t "kills child processes"` | ❌ Wave 0 |

## Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Wave 0 Gaps

- [ ] `tests/shutdown.test.ts` — covers PROC-01, PROC-02, PROC-03
- [ ] Mock setup for `Client`, `PlayerManager`, `GuildPlayer` in test context
- [ ] Integration test: fork process, send SIGTERM, verify exit code and cleanup
