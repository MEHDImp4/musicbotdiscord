# Requirements: Discord Music Bot — Docker Reliability

**Defined:** 2026-09-18
**Core Value:** The bot must work identically in Docker and locally — no platform-specific paths or behavior.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Environment

- [ ] **ENV-01**: yt-dlp path defaults to `yt-dlp` (portable) — no hardcoded Windows paths in .env
- [ ] **ENV-02**: FFmpeg path defaults to `ffmpeg` (portable) — no hardcoded paths in .env
- [ ] **ENV-03**: `.env.docker` file created with Linux-compatible paths
- [ ] **ENV-04**: `docker-compose.yml` uses `.env.docker` instead of host `.env`

### Docker Build

- [ ] **BUILD-01**: Dockerfile includes `HEALTHCHECK` instruction
- [ ] **BUILD-02**: Health check verifies bot process is alive (not just PID exists)
- [ ] **BUILD-03**: `docker-compose.yml` uses `init: true` for proper signal handling
- [ ] **BUILD-04**: `stop_grace_period` set to 15s for graceful shutdown

### Process Management

- [ ] **PROC-01**: Bot handles SIGTERM with force-exit timeout (10s max)
- [ ] **PROC-02**: yt-dlp child processes killed on shutdown (not orphaned)
- [ ] **PROC-03**: Graceful shutdown is idempotent (safe to call multiple times)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Production Hardening

- **PROD-01**: Multi-stage Docker build (build + runtime stages)
- **PROD-02**: Non-root user in container
- **PROD-03**: Log rotation configuration (max-size, max-file)
- **PROD-04**: Resource limits (mem_limit, cpus)
- **PROD-05**: Container labeling (version, environment)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Kubernetes/helm charts | Single-container deployment only |
| CI/CD pipeline | Not requested |
| Monitoring/alerting stack | Not requested |
| Docker Swarm mode | Overkill for single bot |
| Volume mounts | Bot is stateless |

## Traceability

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

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-18*
*Last updated: 2026-09-18 after initial definition*
