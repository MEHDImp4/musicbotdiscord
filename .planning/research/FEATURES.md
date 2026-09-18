# Feature Landscape: Docker Deployment for Discord Music Bot

**Domain:** Containerized Discord bot deployment
**Researched:** 2026-09-18
**Overall confidence:** HIGH

## Executive Summary

This document outlines the feature requirements for making the existing Discord music bot Docker deployment reliable and production-ready. The bot currently works locally on Windows but has Docker-specific issues with hardcoded paths and missing production hardening. Research shows that Discord bot Docker deployments require a minimal set of table stakes features to function reliably, with additional differentiators for production quality.

The current implementation already has some foundations in place (restart policy, graceful shutdown handlers, portable defaults in env.ts), but lacks critical Docker-specific features like health checks, environment separation, and optimized image builds. The key insight is that Discord bots maintain persistent WebSocket connections, which requires special consideration for health checks and graceful shutdown patterns.

## Table Stakes

Features users expect. Missing = Docker deployment feels broken or unreliable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Portable external tool paths** | yt-dlp and FFmpeg paths must work in both Windows and Docker | Low | Already have defaults in env.ts (`"yt-dlp"`, `"ffmpeg"`), but .env file has Windows path |
| **Environment variable separation** | Windows paths break in Docker; need separate .env for Docker | Low | Create `.env.docker` with Linux paths, update docker-compose.yml to use it |
| **Graceful shutdown (SIGTERM)** | Docker sends SIGTERM on `docker stop`; must clean up resources | Low | Already implemented in index.ts with `process.once("SIGTERM")` |
| **Container restart policy** | Container must auto-restart on crash or host reboot | Low | Already in docker-compose.yml: `restart: unless-stopped` |
| **Health check for bot process** | Docker needs to know if bot is alive; orchestrators use this for readiness | Medium | Bot maintains WebSocket connection to Discord; need to expose health endpoint or use process check |
| **Structured logging to stdout** | Docker captures stdout/stderr; file logging fills disk silently | Low | Already using pino logger; ensure it outputs to stdout, not files |
| **Node.js as PID 1** | Signals must reach Node.js process directly for graceful shutdown | Low | Already using `CMD ["node", "dist/index.js"]` (exec form) |

## Differentiators

Features that set product apart. Not expected, but valued for production quality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Multi-stage Docker build** | Reduces image size from ~1GB to ~200MB; faster pulls, smaller attack surface | Medium | Current Dockerfile copies everything; separate build and runtime stages |
| **Non-root user in container** | Security best practice; prevents container breakout attacks | Low | Add `USER node` in Dockerfile after build |
| **Log rotation configuration** | Prevents disk exhaustion from container logs | Low | Configure `max-size` and `max-file` in docker-compose.yml logging section |
| **Resource limits** | Prevents bot from consuming all host memory/CPU | Low | Add `mem_limit` and `cpus` in docker-compose.yml |
| **Docker Compose profiles** | Separate dev and prod configurations without maintaining multiple files | Medium | Use `profiles: [prod]` for production-specific services |
| **Health check endpoint** | External monitoring can verify bot is responsive, not just process alive | Medium | Add HTTP endpoint that checks Discord WebSocket latency and client readiness |
| **Container labeling** | Better container management, logging filtering, and monitoring integration | Low | Add labels for version, environment, and purpose |
| **Init process (tini)** | Proper signal handling and zombie process reaping | Low | Add `init: true` in docker-compose.yml or install tini in Dockerfile |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Kubernetes/helm charts** | Out of scope per PROJECT.md; single-container deployment only | Keep docker-compose.yml as the deployment mechanism |
| **CI/CD pipeline** | Not requested; adds complexity beyond current needs | Document manual deployment steps; let users add their own CI/CD |
| **Monitoring/alerting stack** | Not requested; would require additional services (Prometheus, Grafana) | Rely on Docker's built-in health checks and logging |
| **Multi-container orchestration** | Bot is stateless; no need for Redis, databases, or message queues | Keep single container architecture; add external services only if needed |
| **Volume mounts for persistent data** | Bot is stateless; no data to persist between restarts | Use environment variables for configuration; no volumes needed |
| **Port exposure** | Bot only makes outbound connections to Discord API; no inbound traffic | Do not expose any ports in docker-compose.yml |
| **Docker Swarm mode** | Overkill for single bot deployment; adds orchestration complexity | Stick with docker-compose for local and simple server deployments |
| **Custom entrypoint scripts** | Adds complexity; Node.js handles signals and startup correctly | Use direct `CMD ["node", "dist/index.js"]` |

## Feature Dependencies

```
Portable external tool paths → Environment variable separation (must fix paths before Docker works)
Health check endpoint → Structured logging (health check needs to log status)
Multi-stage build → Non-root user (build in one stage, run as non-root in another)
Log rotation → Structured logging (rotation config depends on stdout logging)
```

## Current State Analysis

**Already implemented:**
- ✅ Graceful shutdown with SIGTERM/SIGINT handlers
- ✅ Container restart policy (`unless-stopped`)
- ✅ Node.js as PID 1 (exec form CMD)
- ✅ Portable defaults in env.ts (`"yt-dlp"`, `"ffmpeg"`)
- ✅ Structured logging with pino

**Missing/broken:**
- ❌ .env file contains Windows-specific path (`YTDLP_PATH=C:\Users\mehdi\...\yt-dlp.exe`)
- ❌ No Docker-specific environment file
- ❌ No health check in Dockerfile or docker-compose.yml
- ❌ No multi-stage build (current Dockerfile copies everything)
- ❌ No log rotation configuration
- ❌ No resource limits
- ❌ Running as root in container
- ❌ No init process for signal handling

## MVP Recommendation

Prioritize:
1. **Environment variable separation** - Create `.env.docker` with Linux paths, update docker-compose.yml
2. **Health check implementation** - Add health check endpoint or process check
3. **Multi-stage Docker build** - Reduce image size and attack surface

Defer:
- **Resource limits**: Add after basic functionality works
- **Docker Compose profiles**: Add when dev/prod separation becomes painful
- **Container labeling**: Add when monitoring needs arise

## Sources

- Docker Compose best practices: https://docs.docker.com/compose/how-tos/environment-variables/best-practices
- Graceful shutdown patterns: https://github.com/ashabhussan/nodejs-bestpractices/blob/master/sections/docker/graceful-shutdown.md
- Health check for Discord bots: https://github.com/psidex/discordhealthcheck
- Multi-stage builds: https://www.docker.com/blog/multi-stage-builds
- Node.js Docker best practices: https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/docker/graceful-shutdown.md
- Discord bot Docker examples: https://github.com/python-discord/bot/blob/main/docker-compose.yml
- yt-dlp Docker images: https://hub.docker.com/r/tnk4on/yt-dlp
