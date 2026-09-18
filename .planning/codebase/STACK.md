# Technology Stack

**Analysis Date:** 2026-09-18

## Languages

**Primary:**
- TypeScript 5.9+ - All application source code (`src/`)
- Node.js 24.17+ - Runtime environment

**Secondary:**
- Python 3 - Required by yt-dlp (installed via pip in Docker)

## Runtime

**Environment:**
- Node.js >= 24.17.0 (specified in `package.json` engines)
- Target: ES2022 (configured in `tsconfig.json`)

**Package Manager:**
- npm (lockfile: `package-lock.json` present)

**Module System:**
- CommonJS (configured in `tsconfig.json` module field)
- tsx used for dev mode (TS execution without build step)

## Frameworks

**Core:**
- discord.js 14.27.0 - Discord API client and gateway connection
- @discordjs/voice 1.0.0-dev.1789257813 - Voice channel connection and audio streaming
- @discordjs/opus 0.10.0 - Opus codec bindings for voice encoding

**Testing:**
- Vitest 5.0.1 - Test runner and assertion library
- Config: `vitest.config.ts` (node environment, setup file `tests/setup.ts`)

**Build/Dev:**
- TypeScript 5.9+ - Type checking and compilation (`tsc`)
- tsx 4.20+ - TypeScript execution for dev mode (`tsx watch`)

## Key Dependencies

**Critical:**
- `discord.js` 14.27.0 - Discord bot framework; provides Client, REST API, SlashCommandBuilder, GatewayIntentBits
- `@discordjs/voice` 1.0.0-dev - Voice connection lifecycle, AudioPlayer, AudioResource creation
- `@discordjs/opus` 0.10.0 - Native Opus encoder for Discord voice (required by @discordjs/voice)
- `pino` 10.3.1 - Structured JSON logging with redaction support

**Infrastructure (external, not npm):**
- `yt-dlp` - YouTube video/audio extraction CLI tool (binary in PATH or `yt-dlp.exe` in repo root on Windows)
- `ffmpeg` - Audio transcoding and format conversion CLI tool

## Configuration

**Environment:**
- `.env` file loaded via `--env-file=.env` flag (Node.js 20.6+ native env loading)
- `.env.example` contains all variables with descriptions
- Config parsed in `src/config/env.ts` with typed accessor object `env`

**Required env vars:**
- `DISCORD_TOKEN` - Bot authentication token
- `DISCORD_CLIENT_ID` - Application/client ID for command registration

**Optional env vars:**
- `DISCORD_GUILD_ID` - Guild-scoped command deployment (empty = global)
- `LOG_LEVEL` - Pino log level (default: `info`)
- `IDLE_TIMEOUT_SECONDS` - Disconnect after silence (default: 300)
- `EMPTY_CHANNEL_TIMEOUT_SECONDS` - Disconnect when channel empties (default: 60)
- `MAX_QUEUE_SIZE` - Queue limit per guild (default: 100)
- `MAX_TRACK_DURATION_MINUTES` - Reject long tracks (default: 180)
- `MAX_STREAM_RETRIES` - Retry count for failed streams (default: 2)
- `YTDLP_PATH` - Path to yt-dlp binary (default: `yt-dlp`)
- `FFMPEG_PATH` - Path to ffmpeg binary (default: `ffmpeg`)
- `EXTERNAL_PROCESS_TIMEOUT_MS` - yt-dlp process timeout (default: 20000)
- `VOICE_CONNECTION_TIMEOUT_MS` - Voice connect timeout (default: 20000)

**Build:**
- `tsconfig.json` - TypeScript compiler options (strict mode, ES2022 target, CommonJS output)
- `vitest.config.ts` - Test configuration (node environment, setup file)

## Platform Requirements

**Development:**
- Node.js >= 24.17.0
- yt-dlp in PATH (or `yt-dlp.exe` in repo root on Windows)
- ffmpeg in PATH
- Python 3 + pip (for yt-dlp installation)

**Production:**
- Docker image: `node:24-bookworm-slim` base
- Installs ffmpeg, python3, pip, build-essential, yt-dlp via apt/pip
- Multi-stage build: npm install -> build -> prune dev deps

## Scripts

```bash
npm install              # Install dependencies
npm run dev              # Dev mode with tsx watch + .env loading
npm run build            # Compile TypeScript to dist/
npm start                # Run production build (node dist/index.js)
npm run deploy:commands  # Register slash commands with Discord API
npm test                 # Run vitest
npm run test:watch       # Vitest watch mode
```

## TypeScript Configuration

**Compiler Options (`tsconfig.json`):**
- `target`: ES2022
- `module`: CommonJS
- `moduleResolution`: Node
- `strict`: true
- `rootDir`: src
- `outDir`: dist
- `esModuleInterop`: true
- `skipLibCheck`: true

---

*Stack analysis: 2026-09-18*
