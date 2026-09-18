# Project Research Summary

**Project:** Discord Music Bot — Docker Reliability
**Domain:** Containerized Discord bot deployment
**Researched:** 2026-09-18
**Confidence:** HIGH

## Executive Summary

This project aims to make an existing Discord music bot (TypeScript + Node.js + discord.js + yt-dlp + FFmpeg) reliably deployable via Docker. The bot currently works locally on Windows but fails in Docker due to hardcoded Windows paths in environment variables and missing production hardening. The research concludes that the fix is straightforward: separate environment files for Windows vs Docker, a multi-stage Docker build, health checks, and standard security practices. The domain is well-documented with established patterns from Docker, Node.js, and discord.js communities.

The recommended approach is a single-container deployment using Docker Compose, with a multi-stage Dockerfile that builds TypeScript in a bookworm-slim image and runs in a minimal alpine image. The critical fix is creating `.env.docker` with Linux paths and updating `docker-compose.yml` to use it instead of the host `.env` file. Health checks should verify the Discord WebSocket connection is alive, not just that the process is running. All of this can be achieved with low-to-medium complexity changes to existing files.

The main risks are: (1) Alpine's musl libc causing issues with native modules like sodium-native, which can be mitigated by falling back to bookworm-slim if needed; (2) zombie processes from Node.js running as PID 1, mitigated with `init: true`; and (3) disk exhaustion from unrotated container logs, mitigated with Docker logging configuration. These are all well-understood problems with documented solutions.

## Key Findings

### Recommended Stack

The stack is already in place and requires no new technologies. The focus is on containerizing the existing stack correctly.

**Core technologies:**
- **Node.js 24**: Runtime — matches existing project, LTS support
- **TypeScript 5.x**: Type safety — already in use
- **discord.js 14.x**: Discord API client — already in use, well-maintained
- **Docker 24+ / Docker Compose 2.x**: Containerization — industry standard
- **yt-dlp + FFmpeg 6.x**: Audio pipeline — already in use
- **pino**: Structured logging — already in use, outputs to stdout (Docker-compatible)

**Key decision:** Use `node:24-bookworm-slim` for build stage, `node:24-alpine` for runtime. If Alpine causes musl libc issues with native modules, fall back to bookworm-slim for runtime too.

### Expected Features

**Must have (table stakes):**
- Portable external tool paths (yt-dlp, FFmpeg) — currently broken in Docker
- Environment variable separation (.env vs .env.docker) — Windows paths break in Docker
- Graceful shutdown (SIGTERM) — already implemented
- Container restart policy — already in docker-compose.yml
- Health check for bot process — missing, critical for production
- Structured logging to stdout — already using pino
- Node.js as PID 1 — already using exec form CMD

**Should have (differentiators):**
- Multi-stage Docker build — reduces image from ~1GB to ~200MB
- Non-root user in container — security best practice
- Log rotation configuration — prevents disk exhaustion
- Resource limits — prevents bot from consuming all host resources
- Init process (tini) — proper signal handling, zombie reaping

**Defer (v2+):**
- Docker Compose profiles — add when dev/prod separation becomes painful
- Container labeling — add when monitoring needs arise
- Health check HTTP endpoint — can start with simple process check

### Architecture Approach

Single-container deployment with multi-stage Docker build. The bot runs as a stateless process maintaining a WebSocket connection to Discord's gateway and making outbound HTTP requests to YouTube. No ports are exposed (bot only makes outbound connections). No volumes needed (bot is stateless). No multi-container orchestration required.

**Major components:**
1. **Node.js Process (PID 1)** — Main application logic, command handling, Discord gateway connection
2. **yt-dlp (external)** — Video metadata extraction, stream URL resolution
3. **FFmpeg (external)** — Audio transcoding, stream conversion for @discordjs/voice
4. **Docker Container** — Isolation, resource management, lifecycle via Docker Compose

### Critical Pitfalls

1. **Windows-specific paths in .env** — Bot fails to start in Docker because .env has `YTDLP_PATH=C:\Users\mehdi\...\yt-dlp.exe`. **Prevention:** Create `.env.docker` with Linux paths, update docker-compose.yml to use it.
2. **Missing health check** — Docker thinks container is running when bot is actually unresponsive (WebSocket disconnected). **Prevention:** Add health check that verifies Discord WebSocket connection is alive.
3. **Running as root in container** — Security vulnerability if container is compromised. **Prevention:** Add `USER node` in Dockerfile after build stage.
4. **No log rotation** — Container logs fill disk space over time. **Prevention:** Configure `max-size` and `max-file` in docker-compose.yml logging section.
5. **Missing init process (tini)** — Zombie processes accumulate, signals not properly forwarded. **Prevention:** Add `init: true` in docker-compose.yml.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Environment Separation
**Rationale:** This is the critical fix — without it, the bot cannot start in Docker at all. Must come first.
**Delivers:** `.env.docker` with Linux paths, updated docker-compose.yml to use it, bot starts successfully in Docker
**Addresses:** Portable external tool paths, environment variable separation
**Avoids:** Pitfall 1 (Windows-specific paths in environment variables)
**Complexity:** Low — file creation and one docker-compose.yml change

### Phase 2: Production Hardening
**Rationale:** Once bot starts in Docker, harden for production reliability. Groups all Docker best practices together.
**Delivers:** Multi-stage Docker build, non-root user, init process, log rotation, resource limits
**Addresses:** Multi-stage Docker build, non-root user, log rotation, resource limits, init process
**Avoids:** Pitfalls 3 (running as root), 4 (no log rotation), 5 (missing init process)
**Uses:** Multi-stage build pattern from ARCHITECTURE.md (bookworm-slim build → alpine runtime)
**Complexity:** Medium — Dockerfile rewrite plus docker-compose.yml additions

### Phase 3: Health Monitoring
**Rationale:** Health checks depend on the bot running correctly (Phase 1) and being properly containerized (Phase 2). Add after basics work.
**Delivers:** Health check in Dockerfile/docker-compose.yml, basic process verification
**Addresses:** Health check for bot process (table stakes from FEATURES.md)
**Avoids:** Pitfall 2 (missing health check configuration)
**Complexity:** Medium — needs HTTP endpoint or process check that verifies Discord WebSocket connection

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Environment fix is prerequisite — bot must start before we can harden it
- **Phase 2 before Phase 3:** Health checks need the bot running in a properly configured container
- **Phase 3 last:** Health monitoring is validation that everything else works
- **Grouping rationale:** Phase 1 is isolated (env files only), Phase 2 groups all Docker config changes, Phase 3 adds monitoring on top

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Alpine musl libc compatibility — need to verify sodium-native and other native modules work on Alpine; may need bookworm-slim fallback

Phases with standard patterns (skip research-phase):
- **Phase 1:** Well-documented Docker environment variable patterns
- **Phase 3:** Standard Docker health check patterns, well-documented in Docker and Node.js communities

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already in use, well-documented, no new dependencies needed |
| Features | HIGH | Clear table stakes from PROJECT.md requirements, well-understood Docker deployment patterns |
| Architecture | HIGH | Single-container pattern is standard for Discord bots, documented examples from python-discord/bot |
| Pitfall 1 (paths) | HIGH | Directly observable in current .env file, clear fix documented |
| Pitfall 2 (health check) | HIGH | Standard Docker pattern, Discord-specific considerations documented |
| Pitfall 3 (root user) | HIGH | Docker security best practice, trivial fix |
| Pitfall 4 (log rotation) | HIGH | Docker Compose configuration, well-documented |
| Pitfall 5 (init process) | HIGH | Single docker-compose.yml line |

**Overall confidence:** HIGH

### Gaps to Address

- **Alpine compatibility:** Need to test whether sodium-native and other native modules compile on Alpine's musl libc. If not, use bookworm-slim for runtime stage. Handle during Phase 2 execution.
- **Health check implementation detail:** Research suggests HTTP endpoint checking Discord WebSocket latency, but a simpler process check might suffice for MVP. Decide during Phase 3 planning.
- **Resource limits tuning:** Research provides rough estimates (256MB memory, 0.5 CPU for single bot) but actual usage should be measured in production. Set conservative limits, adjust later.

## Sources

### Primary (HIGH confidence)
- Docker official images: https://hub.docker.com/_/node
- Node.js Docker best practices: https://github.com/goldbergyoni/nodebestpractices
- discord.js documentation: https://discord.js.org
- Docker multi-stage builds: https://docs.docker.com/build/building/multi-stage
- Docker Compose best practices: https://docs.docker.com/compose/how-tos/environment-variables/best-practices

### Secondary (MEDIUM confidence)
- Graceful shutdown patterns: https://github.com/ashabhussan/nodejs-bestpractices/blob/master/sections/docker/graceful-shutdown.md
- Health check for Discord bots: https://github.com/psidex/discordhealthcheck
- Discord bot Docker examples: https://github.com/python-discord/bot/blob/main/docker-compose.yml
- Docker security best practices: https://docs.docker.com/engine/security/

### Tertiary (LOW confidence)
- yt-dlp Docker images: https://hub.docker.com/r/tnk4on/yt-dlp — community-maintained, may lag behind yt-dlp releases

---
*Research completed: 2026-09-18*
*Ready for roadmap: yes*
