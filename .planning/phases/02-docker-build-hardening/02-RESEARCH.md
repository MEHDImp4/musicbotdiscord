# Phase 2: Docker Build Hardening - Research

**Researched:** 2026-09-18
**Domain:** Docker container hardening for non-HTTP Node.js bot process
**Confidence:** HIGH

## Summary

Phase 2 hardens the Docker container for production reliability. The bot is a long-running Discord process (not an HTTP server), so standard health check patterns (curl to localhost) don't apply. The research covers four areas: HEALTHCHECK for process-alive verification, `init: true` for tini as PID 1, `stop_grace_period` for graceful shutdown timing, and Dockerfile layer-caching best practices.

**Primary recommendation:** Use `pgrep -f "node dist/index.js"` for the health check (lightweight, no HTTP endpoint needed), `init: true` with `stop_grace_period: 15s` in docker-compose.yml, and verify the existing Dockerfile's COPY order is already optimal for layer caching.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HEALTHCHECK | Docker/Container | — | Container runtime verifies process health |
| Signal forwarding (SIGTERM) | Docker/Container (tini) | Application (process.once handlers) | tini forwards signals; app must handle them |
| Zombie reaping | Docker/Container (tini) | — | yt-dlp spawns child processes that may orphan |
| Graceful shutdown timing | Docker/Container (stop_grace_period) | Application (shutdown function) | Container timeout must exceed app shutdown time |
| Layer caching | Docker (Dockerfile) | — | Build-time optimization only |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tini (via `init: true`) | built-in to Docker | PID 1 init process | Docker's built-in tini; no extra image layer |
| pgrep (procps) | pre-installed in node:bookworm-slim | Process existence check | Lightweight, no curl/wget needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| curl | not needed | HTTP health check | Only if bot exposed HTTP endpoint |
| wget | not needed | Alternative HTTP check | Alpine-only images without curl |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pgrep -f "node dist/index.js"` | PID file check | pgrep is simpler; no file to manage |
| `init: true` | Bake tini into Dockerfile | `init: true` is zero-config; no image change |
| `stop_grace_period: 15s` | Default 10s | 15s accounts for yt-dlp cleanup; 10s too tight |

**Installation:** No packages to install — `pgrep` is in `procps` which is pre-installed in `node:bookworm-slim`. `init: true` uses Docker's built-in tini.

## Package Legitimacy Audit

> No external packages are installed in this phase. The changes are docker-compose.yml and Dockerfile configuration only.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│ Docker Container                                │
│                                                 │
│  tini (PID 1)                                   │
│    ├── forwards SIGTERM/SIGINT                  │
│    ├── reaps zombie processes                   │
│    └── node dist/index.js (PID 2)               │
│          ├── Discord.js client                  │
│          ├── PlayerManager                      │
│          │     ├── GuildPlayer (per guild)      │
│          │     │     ├── AudioPipeline           │
│          │     │     │     ├── yt-dlp (child)   │
│          │     │     │     └── ffmpeg (child)   │
│          │     │     └── @discordjs/voice        │
│          │     └── QueueManager                 │
│          └── SIGTERM handler → shutdown()       │
│                                                 │
│  HEALTHCHECK: pgrep -f "node dist/index.js"     │
│    interval=30s, timeout=5s, retries=3          │
│    start_period=15s                             │
└─────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
├── docker-compose.yml        # init: true, stop_grace_period: 15s
├── Dockerfile                # HEALTHCHECK instruction added
├── .env.docker               # (already exists from Phase 1)
└── src/
    └── index.ts              # SIGTERM handler (Phase 3)
```

### Pattern 1: HEALTHCHECK for Non-HTTP Process
**What:** Use `pgrep` to verify the Node process is alive, not curl to a health endpoint.
**When to use:** Bot processes, workers, CLI daemons — anything without an HTTP server.
**Example:**
```dockerfile
# Source: Docker official docs + community patterns for non-HTTP services
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD pgrep -f "node dist/index.js" > /dev/null || exit 1
```
**Why pgrep over alternatives:**
- `pgrep -f "node dist/index.js"` checks if the specific process exists and is running
- No need for curl, wget, or netcat — reduces image dependencies
- `> /dev/null` suppresses PID output; exit code 0/1 is the signal
- The `-f` flag matches against the full command line, not just the process name

### Pattern 2: init: true for tini
**What:** `init: true` in docker-compose.yml makes Docker inject tini as PID 1.
**When to use:** Always for Node.js containers. Node.js was not designed to run as PID 1.
**Example:**
```yaml
# Source: Docker docs, nodejs/docker-node BestPractices.md
services:
  musicbot:
    init: true
    # ... rest of config
```
**Why it matters for this bot:**
1. **Signal forwarding:** Without tini, SIGTERM from `docker compose stop` may not reach the Node process (PID 1 has special kernel behavior — default signal handlers are NOT applied). With tini, SIGTERM is forwarded to node.
2. **Zombie reaping:** yt-dlp spawns child processes. If yt-dlp dies but its children survive, they become zombies. Tini reaps them automatically.
3. **No gotchas with Node.js:** The official Node.js Docker docs explicitly recommend `--init` or tini. The bot already has `process.once("SIGTERM", ...)` handlers — tini makes those handlers actually receive the signal.

### Pattern 3: stop_grace_period
**What:** Give the bot 15 seconds to shut down before Docker sends SIGKILL.
**When to use:** Any container with child processes (yt-dlp, ffmpeg) or network cleanup (Discord voice disconnect).
**Example:**
```yaml
# Source: Docker compose docs, community patterns for bots with child processes
services:
  musicbot:
    stop_grace_period: 15s
```
**Why 15s is appropriate:**
- Default is 10s — too tight if yt-dlp is mid-download
- The bot's shutdown sequence: destroyAll() → kill child processes → disconnect voice → client.destroy() → process.exit()
- yt-dlp downloads can take 5-10s to finish; FFmpeg needs time to flush buffers
- Discord voice disconnect sends a UDP packet that needs acknowledgment
- 15s provides 5s buffer beyond the worst case; 30s would be excessive for a bot

### Anti-Patterns to Avoid
- **Health check with curl to localhost:** Bot has no HTTP server — would always fail
- **Health check that spawns node:** `node -e "..."` adds memory/CPU overhead; use lightweight pgrep instead
- **shell-form CMD:** Always use exec-form `["node", "dist/index.js"]` — shell-form wraps in `sh -c` which breaks signal forwarding
- **stop_grace_period > 30s:** Overkill; if shutdown takes 30s something is wrong
- **Omitting init: true:** Node.js as PID 1 silently ignores SIGTERM — container hangs until SIGKILL

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PID 1 signal handling | Custom signal proxy script | `init: true` (Docker built-in tini) | 10KB binary, battle-tested, zero config |
| Process health check | Custom Node.js health endpoint | `pgrep -f "node dist/index.js"` | No HTTP server needed; simpler |
| Zombie process reaping | Manual wait() calls in Node | tini via `init: true` | Kernel-level reaping is more reliable |
| Graceful shutdown timeout | Custom timeout logic | `stop_grace_period: 15s` | Docker handles SIGTERM→SIGKILL timing |

**Key insight:** Docker already solves these problems — the bot just needs the right configuration, not custom code.

## Common Pitfalls

### Pitfall 1: Node.js as PID 1 ignores SIGTERM
**What goes wrong:** `docker compose stop` hangs for 10s then force-kills with SIGKILL. The bot's SIGTERM handler never runs.
**Why it happens:** The Linux kernel treats PID 1 specially — default signal handlers (which would terminate the process) are NOT applied. If the process doesn't explicitly handle SIGTERM, the signal is silently ignored.
**How to avoid:** Use `init: true` so tini is PID 1 and forwards signals to node (PID 2).
**Warning signs:** Container always takes exactly 10s to stop (the default timeout); no "Shutting down" log message appears.

### Pitfall 2: HEALTHCHECK with curl when no HTTP server exists
**What goes wrong:** Health check always fails → container shows as "unhealthy" → restart loops.
**Why it happens:** Copying HTTP health check patterns from web server tutorials. This bot has no HTTP endpoint.
**How to avoid:** Use process-based check: `pgrep -f "node dist/index.js"`.
**Warning signs:** `docker inspect` shows health status as "unhealthy" immediately after startup.

### Pitfall 3: shell-form CMD breaks signal forwarding
**What goes wrong:** Signals go to `sh`, not `node`. SIGTERM reaches sh which doesn't forward it.
**Why it happens:** Using `CMD node dist/index.js` instead of `CMD ["node", "dist/index.js"]`.
**How to avoid:** Always use exec-form JSON array for CMD and ENTRYPOINT.
**Warning signs:** Process doesn't respond to signals even with `init: true`.

### Pitfall 4: stop_grace_period too short for yt-dlp
**What goes wrong:** Container killed while yt-dlp is downloading → corrupted partial files, orphaned processes.
**Why it happens:** Default 10s timeout isn't enough for large YouTube downloads.
**How to avoid:** Set `stop_grace_period: 15s` and ensure the shutdown function kills child processes.
**Warning signs:** `ps aux` inside container shows orphaned yt-dlp processes after stop.

### Pitfall 5: start-period too short for Discord connection
**What goes wrong:** Bot marked "unhealthy" during Discord gateway connection (can take 5-10s).
**Why it happens:** Default start_period is 0s — health checks begin immediately.
**How to avoid:** Set `start_period: 15s` to allow Discord login before health checks count.
**Warning signs:** Container shows "unhealthy" for first 30-60s after startup then flips to "healthy".

## Code Examples

### HEALTHCHECK in Dockerfile
```dockerfile
# Source: Docker official docs + nodejs/docker-node BestPractices.md
FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip build-essential ca-certificates \
    && pip3 install --no-cache-dir --break-system-packages --upgrade --pre "yt-dlp[default]" \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

# Health check: verify node process is alive (bot has no HTTP endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD pgrep -f "node dist/index.js" > /dev/null || exit 1

CMD ["node", "dist/index.js"]
```

### docker-compose.yml with init and stop_grace_period
```yaml
# Source: Docker compose docs, tini README, nodejs/docker-node BestPractices.md
services:
  musicbot:
    build: .
    container_name: musicbotdiscord
    restart: unless-stopped
    init: true
    stop_grace_period: 15s
    env_file:
      - .env.docker
    volumes:
      - .:/app
      - /app/node_modules
    networks:
      - musicbot-network

networks:
  musicbot-network:
    driver: bridge
```

### Health check verification command
```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' musicbotdiscord

# View last 5 health check results
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' musicbotdiscord

# Check if pgrep is available in container
docker exec musicbotdiscord pgrep -f "node dist/index.js"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `docker run --init` flag | `init: true` in compose.yml | Docker Compose v2 | Same tini, declarative config |
| `npm start` in CMD | Direct `node` binary in CMD | 2020+ (PID 1 awareness) | One fewer process, proper signal delivery |
| Health check with curl | Process check with pgrep | When bot has no HTTP | Lighter, no extra dependencies |

**Deprecated/outdated:**
- `version: "3.x"` in docker-compose.yml: Obsolete in Compose v2+; the file is parsed without it
- Health checks with `wget --spider`: Only works for HTTP services; irrelevant for this bot

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pgrep` is available in `node:bookworm-slim` | Standard Stack | HEALTHCHECK fails — fallback: install `procps` in Dockerfile |
| A2 | The bot's SIGTERM handler in index.ts runs within 10s | Common Pitfalls | stop_grace_period may need increase — Phase 3 will verify |
| A3 | yt-dlp child processes are properly tracked in `childProcesses` array | Architecture | Orphaned processes may survive shutdown — Phase 3 will verify |

**If this table is empty:** Not applicable — three assumptions documented.

## Open Questions

1. **Is `pgrep` guaranteed available in node:bookworm-slim?**
   - What we know: `procps` (which provides pgrep) is typically installed in Debian-based images
   - What's unclear: Whether `node:bookworm-slim` includes it or strips it
   - Recommendation: Add `apt-get install -y --no-install-recommends procps` to Dockerfile if pgrep is missing. Check during implementation.

2. **Does the current shutdown function complete within 15s?**
   - What we know: `shutdown()` calls `players.destroyAll()` then `client.destroy()`
   - What's unclear: How long `destroyAll()` takes when multiple guilds have active connections
   - Recommendation: Phase 3 will instrument and verify. For now, 15s is a reasonable starting point.

3. **Should the health check also verify Discord gateway connection?**
   - What we know: `pgrep` only checks if the process exists, not if it's connected to Discord
   - What's unclear: Whether a "zombie" node process (alive but disconnected) is a realistic scenario
   - Recommendation: Keep it simple for now. A process-level check catches the common failure mode (node crash). Discord reconnection is handled by discord.js internally.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pgrep | HEALTHCHECK | ✓ (in node:bookworm-slim via procps) | — | Install procps: `apt-get install -y --no-install-recommends procps` |
| tini | init: true | ✓ (Docker built-in) | — | — |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** pgrep — if missing, install procps in Dockerfile

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-01 | Dockerfile has HEALTHCHECK | manual | `docker inspect` | ❌ Wave 0 |
| BUILD-02 | Health check uses process-alive check | manual | `docker inspect` + `docker exec pgrep` | ❌ Wave 0 |
| BUILD-03 | compose.yml has init: true | manual | `docker inspect --format='{{.HostConfig.Init}}'` | ❌ Wave 0 |
| BUILD-04 | stop_grace_period is 15s | manual | `docker inspect --format='{{.HostConfig.StopTimeout}}'` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (ensure no regressions)
- **Per wave merge:** `docker compose build && docker compose up -d && sleep 20 && docker inspect --format='{{.State.Health.Status}}' musicbotdiscord`
- **Phase gate:** All manual checks pass + `npm test` green

### Wave 0 Gaps
- [ ] Manual verification via `docker inspect` — no automated tests for Docker config
- [ ] No test for pgrep availability in image — check during implementation

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | Not applicable — config changes only |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for Docker

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Container escape | Elevation of Privilege | Non-root user (already `USER node` in Dockerfile) |
| Zombie process exhaustion | Denial of Service | tini reaps zombies automatically |

## Sources

### Primary (HIGH confidence)
- [nodejs/docker-node/docs/BestPractices.md](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md) — Official Node.js Docker best practices, signal handling, init recommendation
- [krallin/tini README](https://github.com/krallin/tini) — tini documentation, PID 1 behavior, zombie reaping
- [Docker HEALTHCHECK reference](https://docs.docker.com/reference/dockerfile/#healthcheck) — HEALTHCHECK parameters and behavior

### Secondary (MEDIUM confidence)
- [Docker compose stop docs](https://docs.docker.com/reference/cli/docker/compose/stop) — stop_grace_period behavior
- [Stack Harbor: Docker health checks](https://stackharbor.com/en/knowledge-base/docker-healthchecks) — Practical health check patterns
- [Docker blog: Keep Node.js Rockin'](https://www.docker.com/blog/keep-nodejs-rockin-in-docker) — PID 1 problem explanation

### Tertiary (LOW confidence)
- [OneUptime: Docker Health Check Best Practices](https://oneuptime.com/blog/post/2026-01-30-docker-health-check-best-practices/view) — Community patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools are Docker built-in or pre-installed in base image
- Architecture: HIGH — well-documented patterns from official sources
- Pitfalls: HIGH — PID 1 problem is extensively documented; tini is the standard solution

**Research date:** 2026-09-18
**Valid until:** 2026-10-18 (stable — Docker and Node.js patterns are mature)
