# Phase 1: Environment Separation - Research

**Researched:** 2026-09-18
**Domain:** Docker environment variable management, cross-platform path portability
**Confidence:** HIGH

## Summary

Phase 1 solves a single root cause: the bot's `.env` file contains a Windows-specific absolute path (`YTDLP_PATH=C:\Users\mehdi\...\yt-dlp.exe`) that breaks in Docker's Linux environment. The Dockerfile already installs yt-dlp to `/usr/local/bin/yt-dlp` and FFmpeg to `/usr/bin/ffmpeg` — both on PATH — so the fix is to ensure the container receives environment variables with portable values (`yt-dlp`, `ffmpeg`) instead of the Windows host's `.env`.

The recommended approach is a single new file (`.env.docker`) containing Linux-compatible values, referenced by `docker-compose.yml` via the `env_file` attribute. The existing `.env` file is left completely untouched for local Windows development. No code changes to `src/config/env.ts` are needed — it already falls back to `"yt-dlp"` and `"ffmpeg"` when env vars are unset, and `.env.docker` will supply those values explicitly.

This is the minimum viable fix: one new file, one line changed in `docker-compose.yml`, zero changes to application code. The bot starts in Docker without path errors, and local `npm run dev` continues working identically.

**Primary recommendation:** Create `.env.docker` as a committable template with placeholder secrets and real Linux paths. Change `docker-compose.yml` `env_file` from `.env` to `.env.docker`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Environment variable loading | API / Backend (env.ts) | Docker Container | env.ts reads `process.env`; Docker injects via env_file |
| yt-dlp path resolution | API / Backend (YouTubeProvider) | — | Uses `env.ytdlpPath` which comes from env.ts |
| FFmpeg path resolution | API / Backend (GuildPlayer) | — | Uses `env.ffmpegPath` which comes from env.ts |
| Docker env injection | Docker Container (Compose) | — | `env_file` attribute controls what the container sees |
| Local dev env loading | API / Backend (dotenv) | — | `npm run dev` loads `.env` via tsx/dotenv |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Docker Compose | 2.x | Container orchestration | Industry standard, already in use |
| env_file attribute | Compose 2.x | Inject env vars into container | Official Docker mechanism for per-environment config |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | — | Local dev env loading | Already used by tsx watch in `npm run dev` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `.env.docker` separate file | `environment:` overrides in docker-compose.yml | Overrides only change specific vars; `.env.docker` is a single source of truth for all Docker env |
| `.env.docker` separate file | `COMPOSE_ENV_FILES` env var | Adds a dependency on shell env; less portable across machines |
| `.env.docker` separate file | Docker secrets | Overkill for a bot with 2 secrets; adds complexity |

**Installation:** No new packages needed. This phase changes only config files.

## Package Legitimacy Audit

No external packages are installed in this phase. N/A.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Host Machine (Windows)                   │
│                                                              │
│  .env ──────────────────► npm run dev (tsx watch)           │
│  (YTDLP_PATH=C:\...\yt-dlp.exe)   (local dev only)         │
│                                                              │
│  .env.docker ──────────► docker compose up                  │
│  (YTDLP_PATH=yt-dlp)     (Linux container)                  │
│                              │                               │
│                              ▼                               │
│                    ┌──────────────────┐                      │
│                    │ Docker Container │                      │
│                    │ (bookworm-slim)  │                      │
│                    │                  │                      │
│                    │ env.ts reads     │                      │
│                    │ process.env:     │                      │
│                    │  YTDLP_PATH=yt-dlp│                     │
│                    │  FFMPEG_PATH=ffmpeg│                    │
│                    │                  │                      │
│                    │ /usr/local/bin/  │                      │
│                    │   yt-dlp (pip)   │                      │
│                    │ /usr/bin/ffmpeg  │                      │
│                    │   (apt)          │                      │
│                    └──────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### Environment Flow

```
Local Dev:  .env (Windows paths) ──► dotenv ──► process.env ──► env.ts ──► YouTubeProvider
Docker:     .env.docker (Linux paths) ──► Compose env_file ──► process.env ──► env.ts ──► YouTubeProvider
```

### env_file Precedence (Docker Compose)

Per Docker docs, when using `env_file` in docker-compose.yml:
- The file is passed **verbatim** to the container (no interpolation)
- Multiple files override in order (later wins)
- Shell env vars override `env_file` values
- `environment:` attribute overrides `env_file` values

**Key insight:** The `.env` file in the project root is used by Compose for `${VAR}` interpolation in docker-compose.yml itself. The `env_file` attribute is what injects vars into the container. These are two separate mechanisms. Our current `env_file: - .env` passes the Windows `.env` directly into the container — that's the bug.

### Pattern 1: Separate Environment Files

**What:** Create per-environment `.env` files and reference the correct one in `env_file`
**When to use:** When the same app runs on different OSes or in different environments with incompatible config
**Example:**
```yaml
# docker-compose.yml
services:
  musicbot:
    build: .
    container_name: musicbotdiscord
    restart: unless-stopped
    env_file:
      - .env.docker
```

### Pattern 2: Template + Actual Pattern

**What:** `.env.docker` is committed as a template with placeholder secrets; user fills in actual values locally
**When to use:** When secrets can't be committed but config structure should be documented
**Example:**
```bash
# .env.docker (committed)
DISCORD_TOKEN=YOUR_DISCORD_TOKEN_HERE
DISCORD_CLIENT_ID=YOUR_CLIENT_ID_HERE
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
```

### Anti-Patterns to Avoid

- **Overriding individual vars in docker-compose.yml:** Tedious, error-prone, and mixes config with orchestration. Use `env_file` for the full set.
- **Using the same `.env` for local and Docker:** Windows paths break in Linux containers. This is the current bug.
- **Committing real secrets in `.env.docker`:** Use placeholders; document that users must fill them in.
- **Adding `.env.docker` to `.gitignore`:** Then no one else knows what vars are needed. Keep it as a committable template.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path detection (Windows vs Linux) | Runtime OS detection + path mapping | Separate env files | Env files are simpler, no code changes needed |
| Environment switching | Custom script to swap .env files | `docker-compose.yml` env_file | Compose already handles this natively |
| Secret management | Encrypt .env files | Placeholder template pattern | Overkill for 2 secrets in a bot project |

**Key insight:** The env.ts fallback logic (`process.env.YTDLP_PATH?.trim() || "yt-dlp"`) means the container doesn't even NEED `YTDLP_PATH` in env — it would default to `"yt-dlp"`. But explicit is better than implicit: `.env.docker` should set it explicitly for clarity and to match `.env.example`.

## Common Pitfalls

### Pitfall 1: Compose `.env` vs `env_file` Confusion
**What goes wrong:** Developer thinks `.env` in project root is injected into the container
**Why it happens:** Docker docs use `.env` for two different things (project-level interpolation vs container injection)
**How to avoid:** Remember: `.env` in project root = Compose interpolation only. `env_file` attribute = what the container actually receives.
**Warning signs:** Container has unexpected env var values; env vars from `.env` don't appear in container

### Pitfall 2: Forgetting to Fill in .env.docker Secrets
**What goes wrong:** Container starts but crashes with "Missing required environment variable: DISCORD_TOKEN"
**Why it happens:** `.env.docker` has placeholder values that aren't replaced
**How to avoid:** Document clearly in `.env.docker` that placeholders must be filled. Consider adding a startup check.
**Warning signs:** Container exits immediately with env var error

### Pitfall 3: .env.docker Not in .gitignore When It Has Real Secrets
**What goes wrong:** Real Discord token committed to git history
**Why it happens:** Developer fills in real values and commits the file
**How to avoid:** Keep placeholders in committed version. If real values are needed, add `.env.docker` to `.gitignore` and document locally.
**Warning signs:** `git log` shows .env.docker with real tokens

### Pitfall 4: Windows Line Endings in .env.docker
**What goes wrong:** Container reads `\r\n` line endings, env values have trailing `\r`
**Why it happens:** File created on Windows with CRLF line endings
**How to avoid:** Ensure `.env.docker` uses LF line endings. Git's `autocrlf` may convert on checkout.
**Warning signs:** yt-dlp path appears as `yt-dlp\r` in container, command not found

## Code Examples

### env.ts — No Changes Needed

```typescript
// Source: src/config/env.ts (existing, no changes required)
// The fallback logic already handles the Docker case:
ytdlpPath: process.env.YTDLP_PATH?.trim() || "yt-dlp",    // defaults to "yt-dlp"
ffmpegPath: process.env.FFMPEG_PATH?.trim() || "ffmpeg",   // defaults to "ffmpeg"
```

### docker-compose.yml — Change env_file

```yaml
# Source: docker-compose.yml (change line 7)
services:
  musicbot:
    build: .
    container_name: musicbotdiscord
    restart: unless-stopped
    env_file:
      - .env.docker    # was: - .env
```

### .env.docker — New File

```bash
# Docker environment — Linux-compatible paths
# Copy this file and fill in your Discord credentials before running:
#   docker compose up

DISCORD_TOKEN=YOUR_DISCORD_TOKEN_HERE
DISCORD_CLIENT_ID=YOUR_CLIENT_ID_HERE
# Development only. Leave empty to deploy global commands.
DISCORD_GUILD_ID=

LOG_LEVEL=info
IDLE_TIMEOUT_SECONDS=300
EMPTY_CHANNEL_TIMEOUT_SECONDS=60
MAX_QUEUE_SIZE=100
MAX_TRACK_DURATION_MINUTES=180
MAX_STREAM_RETRIES=2
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
EXTERNAL_PROCESS_TIMEOUT_MS=20000
VOICE_CONNECTION_TIMEOUT_MS=20000
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `.env` for all environments | Separate `.env` (local) + `.env.docker` (container) | Phase 1 | Fixes path breakage in Docker |

**Current state:**
- `.env` has `YTDLP_PATH=C:\Users\mehdi\...\yt-dlp.exe` — Windows-only
- `.env.example` has `YTDLP_PATH=yt-dlp` — already portable
- `env.ts` defaults to `"yt-dlp"` — already portable
- Dockerfile installs yt-dlp to `/usr/local/bin/yt-dlp` — already on PATH
- **The only broken link:** `docker-compose.yml` `env_file: - .env` passes Windows paths into Linux container

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.env.docker` should be committed as a template with placeholder secrets | Architecture Patterns | If user expects real secrets in it, they'll need to add it to .gitignore |
| A2 | No code changes to env.ts are needed — fallback logic handles Docker case | Code Examples | Minimal risk; env.ts already defaults to portable values |
| A3 | LF line endings in .env.docker won't be auto-converted by git on Windows | Common Pitfalls | Could cause "command not found" errors in container; verify with `git config core.autocrlf` |
| A4 | Docker Compose env_file passes values verbatim (no interpolation) | Architecture Patterns | If false, `${VAR}` syntax in .env.docker would not work as expected |

## Open Questions

1. **Should `.env.docker` contain real Discord token or placeholders only?**
   - What we know: `.env` has real token, `.env.example` has empty values
   - What's unclear: Whether Docker users expect to fill in credentials or have them auto-populated
   - Recommendation: Use placeholders (`YOUR_DISCORD_TOKEN_HERE`) — matches `.env.example` pattern, safe to commit

2. **Should we add `.env.docker` to `.gitignore`?**
   - What we know: `.env` is gitignored (line 3 of .gitignore)
   - What's unclear: Whether `.env.docker` should also be gitignored
   - Recommendation: Do NOT gitignore — it's a template. Real secrets aren't in it. If user fills in real values, they should add it to .gitignore themselves.

3. **Do we need to handle CRLF/LF line endings?**
   - What we know: Windows uses CRLF, Docker uses LF
   - What's unclear: Whether git's `autocrlf` will cause issues
   - Recommendation: Add `*.env.docker text eol=lf` to `.gitattributes` if needed, or verify during execution

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | docker compose up | ✓ (assumed) | — | — |
| Docker Compose | Container orchestration | ✓ (assumed) | — | — |

**Missing dependencies with no fallback:** None — this phase only changes config files.

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is `false` in config.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | env.ts validates integer env vars, throws on invalid |
| V6 Cryptography | no | No crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret in env var visible via `docker inspect` | Information Disclosure | Placeholder values in committed .env.docker; real secrets only in local untracked file |
| .env.docker committed with real token | Information Disclosure | Use placeholders; document that users fill in locally |

## Sources

### Primary (HIGH confidence)
- Docker Compose env_file docs: https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/
- Docker Compose variable precedence: https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/
- Docker Compose interpolation: https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/

### Secondary (MEDIUM confidence)
- Docker environment best practices blog: https://blog.gntech.me/posts/2026-05-24-docker-compose-env-variables/

### Tertiary (LOW confidence)
- None — all findings verified against official Docker docs

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — Docker Compose env_file is well-documented, official mechanism
- Architecture: HIGH — Simple file-based separation, no code changes needed
- Pitfalls: HIGH — CRLF and gitignore issues are well-known, documented solutions exist

**Research date:** 2026-09-18
**Valid until:** 2026-10-18 (stable — Docker Compose env_file API is stable)
