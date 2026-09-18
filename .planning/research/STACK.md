# Technology Stack

**Project:** Discord Music Bot Docker Deployment
**Researched:** 2026-09-18

## Recommended Stack

### Core Runtime
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 24 | Runtime environment | Matches existing project, LTS support |
| TypeScript | 5.x | Type safety | Already in use, compiles to JavaScript |
| discord.js | 14.x | Discord API client | Already in use, well-maintained |

### Container Runtime
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker | 24+ | Containerization | Industry standard, good Node.js support |
| Docker Compose | 2.x | Single-container deployment | Simple configuration, already in use |

### Audio Processing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| yt-dlp | latest | YouTube video/audio extraction | Already in use, actively maintained |
| FFmpeg | 6.x | Audio conversion and streaming | Required by @discordjs/voice |

### Development Tools
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tsx | latest | TypeScript execution | Already in use for dev mode |
| vitest | latest | Testing framework | Already in use |

### Base Images
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| node:24-bookworm-slim | latest | Build stage | Full Node.js with build tools |
| node:24-alpine | latest | Runtime stage | Minimal image for production |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | latest | Structured logging | Always (already in use) |
| @discordjs/voice | latest | Voice channel connections | Always (already in use) |
| sodium-native | latest | Encryption for voice | When voice encryption needed |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Base Image | node:24-bookworm-slim | node:24-alpine | Alpine has musl libc issues with some native modules |
| Package Manager | npm | yarn/pnpm | npm is default, no reason to switch |
| Process Manager | Node.js directly | PM2 | Single container, no need for process manager |
| Health Check | HTTP endpoint | TCP socket | HTTP provides more information about bot health |
| Logging | stdout via pino | File logging | Docker captures stdout; file logging fills disk |

## Installation

```bash
# Core dependencies (already in package.json)
npm install

# Build for Docker
npm run build

# Docker build
docker build -t musicbotdiscord .

# Docker run
docker run --env-file .env.docker musicbotdiscord
```

## Configuration Files

| File | Purpose | Notes |
|------|---------|-------|
| `.env` | Local Windows development | Contains Windows-specific paths |
| `.env.docker` | Docker deployment | Linux paths, portable defaults |
| `docker-compose.yml` | Container orchestration | Single service configuration |
| `Dockerfile` | Image build instructions | Multi-stage build recommended |

## Sources

- Docker official images: https://hub.docker.com/_/node
- Node.js Docker best practices: https://github.com/goldbergyoni/nodebestpractices
- discord.js documentation: https://discord.js.org
- yt-dlp Docker images: https://hub.docker.com/r/tnk4on/yt-dlp
