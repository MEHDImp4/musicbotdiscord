# Domain Pitfalls

**Domain:** Containerized Discord bot deployment
**Researched:** 2026-09-18

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Windows-Specific Paths in Environment Variables
**What goes wrong:** Bot fails to start in Docker because .env file contains Windows paths like `YTDLP_PATH=C:\Users\mehdi\...\yt-dlp.exe`
**Why it happens:** Developer uses same .env file for local Windows development and Docker deployment
**Consequences:** Container crashes on startup, yt-dlp not found, music playback fails
**Prevention:** Create separate `.env.docker` with Linux paths, update docker-compose.yml to use it
**Detection:** Container logs show "yt-dlp not found" or similar path errors

### Pitfall 2: Missing Health Check Configuration
**What goes wrong:** Docker thinks container is running when bot is actually unresponsive (WebSocket disconnected)
**Why it happens:** No health check defined in Dockerfile or docker-compose.yml
**Consequences:** Zombie container that appears running but doesn't respond to commands
**Prevention:** Add health check that verifies Discord WebSocket connection is alive
**Detection:** Bot appears online in Docker but doesn't respond to Discord commands

### Pitfall 3: Running as Root in Container
**What goes wrong:** Security vulnerability if container is compromised
**Why it happens:** Default Docker behavior runs processes as root
**Consequences:** Container breakout could compromise host system
**Prevention:** Add `USER node` in Dockerfile after build stage
**Detection:** Security scans flag root user in container

## Moderate Pitfalls

### Pitfall 1: No Log Rotation Configuration
**What goes wrong:** Container logs fill disk space over time
**Why it happens:** Default Docker logging driver doesn't rotate logs
**Consequences:** Host runs out of disk space, container crashes
**Prevention:** Configure `max-size` and `max-file` in docker-compose.yml logging section
**Detection:** Host disk usage grows continuously

### Pitfall 2: Missing Init Process (tini)
**What goes wrong:** Zombie processes accumulate, signals not properly forwarded
**Why it happens:** Node.js isn't designed to be PID 1 in Linux
**Consequences:** Memory leaks, shutdown issues, orphaned processes
**Prevention:** Add `init: true` in docker-compose.yml or install tini in Dockerfile
**Detection:** Container memory grows over time, shutdown takes too long

### Pitfall 3: No Resource Limits
**What goes wrong:** Bot consumes all available memory/CPU, affecting other services
**Why it happens:** No resource constraints defined in Docker configuration
**Consequences:** Host becomes unresponsive, other containers affected
**Prevention:** Set `mem_limit` and `cpus` in docker-compose.yml
**Detection:** Host performance degrades when bot is running

## Minor Pitfalls

### Pitfall 1: Exposing Unnecessary Ports
**What goes wrong:** Container has open ports that could be exploited
**Why it happens:** Copying Docker examples that expose ports
**Consequences:** Attack surface increased, potential security vulnerability
**Prevention:** Don't expose any ports; bot only makes outbound connections
**Detection:** Security scans show open ports in container

### Pitfall 2: Using npm install Instead of npm ci
**What goes wrong:** Non-deterministic builds, potential dependency conflicts
**Why it happens:** Using npm install in Dockerfile instead of npm ci
**Consequences:** Different builds produce different results, harder to reproduce issues
**Prevention:** Use `npm ci` in Dockerfile for deterministic installs
**Detection:** Build outputs differ between runs

### Pitfall 3: Not Using .dockerignore
**What goes wrong:** Unnecessary files copied into Docker context, slowing builds
**Why it happens:** No .dockerignore file or incomplete ignore patterns
**Consequences:** Larger build context, slower builds, potential inclusion of sensitive files
**Prevention:** Create .dockerignore with node_modules, .git, .env, etc.
**Detection:** Build takes longer than expected, image larger than necessary

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Environment Separation | Windows paths in .env | Create .env.docker with Linux paths |
| Health Check | Discord WebSocket not checked | Verify client.ready and ping in health endpoint |
| Multi-stage Build | Alpine musl libc issues | Use bookworm-slim for runtime if native modules fail |
| Production Hardening | Missing log rotation | Configure max-size and max-file in docker-compose.yml |

## Sources

- Node.js Docker best practices: https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/docker/graceful-shutdown.md
- Docker security best practices: https://docs.docker.com/engine/security/
- Discord bot Docker examples: https://github.com/python-discord/bot/blob/main/docker-compose.yml
- yt-dlp Docker issues: https://github.com/yt-dlp/yt-dlp/issues
