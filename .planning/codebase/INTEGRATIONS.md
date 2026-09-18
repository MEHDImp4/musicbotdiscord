# External Integrations

**Analysis Date:** 2026-09-18

## APIs & External Services

**Discord API:**
- Gateway connection for real-time events (voice state updates, interactions)
- REST API v10 for slash command registration and interaction responses
- Client library: `discord.js` 14.27.0
- Auth: `DISCORD_TOKEN` env var
- Command deployment: `src/deploy-commands.ts` uses `REST` + `Routes` from discord.js
- Intents used: `Guilds`, `GuildVoiceStates`

**YouTube (via yt-dlp):**
- Not a direct API integration — uses yt-dlp CLI as a subprocess
- yt-dlp fetches video metadata (`--dump-json`) and streams audio (`-f bestaudio/best -o -`)
- URL validation restricted to YouTube domains only: `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`
- Search via yt-dlp: `ytsearch1:<query>` syntax
- Implementation: `src/providers/YouTubeProvider.ts`

## Data Storage

**Databases:**
- None. This is a stateless bot — all state is in-memory per guild.

**File Storage:**
- Local filesystem only
- Logs written to `bot.log`, `bot_error.log`, `bot_output.log`, `bot.err` (gitignored)
- No persistent data storage

**Caching:**
- None. Track metadata is resolved just-in-time, not cached.

## Audio Pipeline

**yt-dlp (subprocess):**
- Purpose: Extract audio stream from YouTube URLs
- Spawn: `spawn(env.ytdlpPath, args, { shell: false })` in `src/providers/YouTubeProvider.ts`
- Args: `--js-runtimes node --no-playlist --no-warnings -f bestaudio/best -o -`
- Metadata: `--dump-json --skip-download`
- Timeout: `EXTERNAL_PROCESS_TIMEOUT_MS` (default 20s)

**FFmpeg (subprocess):**
- Purpose: Transcode audio to Discord-compatible format (s16le PCM, 48kHz, stereo)
- Spawn: `spawn(env.ffmpegPath, args, { shell: false })` in `src/audio/AudioPipeline.ts`
- Input: piped from yt-dlp stdout
- Output: piped to `createAudioResource()` from `@discordjs/voice`
- Diagnostic mode: generates 440Hz sine wave for 3 seconds (`src/music/GuildPlayer.ts:203`)

**@discordjs/voice:**
- Purpose: Discord voice connection and audio playback
- Connection: `joinVoiceChannel()` with `selfDeaf: true`
- Player: `createAudioPlayer()` with `NoSubscriberBehavior.Pause`
- Resource: `createAudioResource()` with `StreamType.Raw`
- State tracking: `entersState()` for connection readiness with timeout

## Authentication & Identity

**Auth Provider:**
- Discord Bot Token — single token for all bot operations
- No user-level OAuth — bot operates under its own identity
- Token stored in: `DISCORD_TOKEN` env var
- Redacted in logs: pino redact config in `src/utils/logger.ts` covers `token`, `discordToken`, `authorization`, `headers.authorization`

## Monitoring & Observability

**Error Tracking:**
- No external error tracking service (Sentry, etc.)
- Errors logged via pino to stdout and file

**Logs:**
- Framework: `pino` 10.3.1
- Configuration: `src/utils/logger.ts`
- Level: configurable via `LOG_LEVEL` env var (default: `info`)
- Output: structured JSON to stdout (captured to `bot_output.log` in production)
- Redaction: sensitive fields automatically censored
- Log files: `bot.log`, `bot_error.log`, `bot_output.log`, `bot.err` (all gitignored)

**Key log events:**
- Bot startup and Discord client ready
- Voice connection state changes
- Audio player state transitions (PLAYING, PAUSED, IDLE)
- yt-dlp and FFmpeg process lifecycle (stderr, close, errors)
- Command execution failures
- Track add/skip/queue operations

## CI/CD & Deployment

**Hosting:**
- Docker: `docker-compose.yml` with `restart: unless-stopped`
- Base image: `node:24-bookworm-slim`
- Environment: `.env` file mounted via `env_file` directive

**CI Pipeline:**
- None configured (no GitHub Actions, no CI config files)

**Docker Build (`Dockerfile`):**
1. Install system deps: ffmpeg, python3, pip, build-essential
2. Install yt-dlp via pip
3. `npm install` production deps
4. Copy source, run `npm run build`
5. `npm prune --omit=dev` to remove dev dependencies
6. Run: `node dist/index.js`

## Environment Configuration

**Required env vars:**
- `DISCORD_TOKEN` — Bot authentication
- `DISCORD_CLIENT_ID` — Application ID for command registration

**Optional env vars:**
- `DISCORD_GUILD_ID` — Guild-scoped dev commands
- `LOG_LEVEL` — Pino log level
- `IDLE_TIMEOUT_SECONDS` — Auto-disconnect timer
- `EMPTY_CHANNEL_TIMEOUT_SECONDS` — Empty channel disconnect
- `MAX_QUEUE_SIZE` — Per-guild queue limit
- `MAX_TRACK_DURATION_MINUTES` — Track length limit
- `MAX_STREAM_RETRIES` — Stream retry count
- `YTDLP_PATH` — yt-dlp binary path
- `FFMPEG_PATH` — ffmpeg binary path
- `EXTERNAL_PROCESS_TIMEOUT_MS` — Subprocess timeout
- `VOICE_CONNECTION_TIMEOUT_MS` — Voice connect timeout

**Secrets location:**
- `.env` file (gitignored, not committed)
- No external secret manager

## Webhooks & Callbacks

**Incoming:**
- Discord Gateway events (voice state updates, button interactions)
- Handled in `src/index.ts` via `client.on(Events.*)` handlers

**Outgoing:**
- None. Bot does not make outbound HTTP requests (aside from Discord API via discord.js).

## External Process Management

**Process spawning pattern:**
- All external processes use `spawn()` with `shell: false` and `windowsHide: true`
- Timeout enforcement via `setTimeout` + `SIGKILL` in `src/utils/process.ts`
- Output size limit: 2MB (configurable per call)
- Process cleanup: `SIGKILL` on timeout or destroy

**Files involved:**
- `src/utils/process.ts` — Generic `runProcess()` utility with timeout and output limits
- `src/providers/YouTubeProvider.ts` — yt-dlp spawn for metadata and streaming
- `src/audio/AudioPipeline.ts` — FFmpeg spawn for audio transcoding
- `src/music/GuildPlayer.ts` — FFmpeg spawn for diagnostic tone

---

*Integration audit: 2026-09-18*
