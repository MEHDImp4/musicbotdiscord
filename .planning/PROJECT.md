# Discord Music Bot — Docker Reliability

## What This Is

A Discord music bot (TypeScript + Node.js) that currently works locally on Windows but fails in Docker due to hardcoded paths and missing production hardening. The goal is to make Docker a reliable, production-ready deployment method.

## Core Value

The bot must work identically in Docker and locally — no platform-specific paths or behavior.

## Requirements

### Validated

- ✓ Discord slash commands work — existing
- ✓ YouTube search and playback works — existing
- ✓ Queue management per guild works — existing
- ✓ yt-dlp + FFmpeg audio pipeline works locally — existing
- ✓ Docker builds successfully — existing

### Active

- [ ] yt-dlp path must be portable across Windows and Docker
- [ ] FFmpeg path must be portable across Windows and Docker
- [ ] Docker container includes health check for the bot process
- [ ] Graceful shutdown in Docker (SIGTERM handling)
- [ ] Container restart policy for production reliability
- [ ] Structured logging in Docker (stdout/journald compatible)
- [ ] Dev vs prod Docker configurations separated

### Out of Scope

- Kubernetes/helm charts — single-container deployment only
- CI/CD pipeline — not requested
- Monitoring/alerting stack — not requested

## Context

- Current `.env` has Windows-specific `YTDLP_PATH=C:\Users\mehdi\...\yt-dlp.exe`
- `.env.example` already has portable default `YTDLP_PATH=yt-dlp`
- Dockerfile installs yt-dlp via pip to `/usr/local/bin/yt-dlp`
- `env.ts` falls back to `"yt-dlp"` when env var is unset
- `docker-compose.yml` currently mounts host `.env` (inherits Windows path)
- Bot uses `process.once("SIGINT"/"SIGTERM")` for shutdown

## Constraints

- **Tech stack**: Must work with existing TypeScript + discord.js + @discordjs/voice + yt-dlp + FFmpeg
- **Backward compatible**: Local Windows dev must continue working unchanged
- **Single container**: No multi-container orchestration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep .env for local, separate Docker env | Windows paths break in Docker | — Pending |

---
*Last updated: 2026-09-18 after initialization*
