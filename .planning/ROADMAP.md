# Roadmap: Discord Music Bot — Docker Reliability

**Project:** Discord Music Bot — Docker Reliability
**Core Value:** The bot must work identically in Docker and locally — no platform-specific paths or behavior.
**Granularity:** Coarse (3 phases)

## Phases

- [ ] **Phase 1: Environment Separation** - Bot starts in Docker by eliminating Windows-specific paths
- [ ] **Phase 2: Docker Build Hardening** - Production-ready container with health checks, init process, and signal handling
- [ ] **Phase 3: Graceful Shutdown** - Bot shuts down cleanly in Docker without orphaned processes

## Phase Details

### Phase 1: Environment Separation
**Goal**: The bot starts and runs in Docker using Linux-compatible paths, with no changes to local Windows development workflow.
**Depends on**: Nothing (first phase)
**Requirements**: ENV-01, ENV-02, ENV-03, ENV-04
**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts the bot without path-related errors (yt-dlp and FFmpeg found)
  2. Local `npm run dev` continues to work with the existing `.env` file unchanged
  3. `.env.docker` contains Linux-compatible paths (`yt-dlp`, `ffmpeg`) — no Windows paths
**Plans:** 1 plan

Plans:
- [ ] 01-01-PLAN.md — Create .env.docker and update docker-compose.yml to use it

### Phase 2: Docker Build Hardening
**Goal**: The container is production-ready with proper process management, health verification, and signal forwarding.
**Depends on**: Phase 1
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04
**Success Criteria** (what must be TRUE):
  1. `docker inspect` shows a HEALTHCHECK instruction configured on the container
  2. Container uses `init: true` — no zombie processes accumulate during runtime
  3. `docker compose stop` allows up to 15 seconds for the bot to shut down gracefully
**Plans**: TBD

### Phase 3: Graceful Shutdown
**Goal**: The bot handles SIGTERM cleanly — destroying players, killing child processes, and exiting without hanging.
**Depends on**: Phase 2
**Requirements**: PROC-01, PROC-02, PROC-03
**Success Criteria** (what must be TRUE):
  1. `docker compose stop` completes within 10 seconds — bot does not hang on shutdown
  2. No orphaned yt-dlp or FFmpeg processes remain after the container stops
  3. Sending SIGTERM twice does not crash or corrupt state — shutdown is idempotent
**Plans**: TBD

## Coverage Map

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | Phase 1 | Pending |
| ENV-02 | Phase 1 | Pending |
| ENV-03 | Phase 1 | Pending |
| ENV-04 | Phase 1 | Pending |
| BUILD-01 | Phase 2 | Pending |
| BUILD-02 | Phase 2 | Pending |
| BUILD-03 | Phase 2 | Pending |
| BUILD-04 | Phase 2 | Pending |
| PROC-01 | Phase 3 | Pending |
| PROC-02 | Phase 3 | Pending |
| PROC-03 | Phase 3 | Pending |

**Coverage:** 11/11 v1 requirements mapped ✓

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Environment Separation | 0/1 | Not started | - |
| 2. Docker Build Hardening | 0/3 | Not started | - |
| 3. Graceful Shutdown | 0/3 | Not started | - |

---
*Created: 2026-09-18*
