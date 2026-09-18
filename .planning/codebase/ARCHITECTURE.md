<!-- refreshed: 2026-09-18 -->
# Architecture

**Analysis Date:** 2026-09-18

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Discord Gateway                          │
│              (discord.js Client + Events)                    │
├─────────────────────────────────────────────────────────────┤
│                     Entry Point                              │
│  `src/index.ts`                                             │
│  - Creates Client with Guilds + GuildVoiceStates intents    │
│  - Routes InteractionCreate → commands / button handlers    │
│  - Routes VoiceStateUpdate → empty-channel detection        │
│  - Handles SIGINT/SIGTERM shutdown                          │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             ▼                                ▼
┌────────────────────────┐   ┌────────────────────────────────┐
│   Commands Layer        │   │   Interactions Layer            │
│ `src/commands/index.ts` │   │ `src/interactions/musicControls`│
│ All slash commands in   │   │ Button handler for pause/resume/│
│ single CommandDef[]     │   │ skip/stop embedded controls     │
└────────────┬───────────┘   └───────────────┬────────────────┘
             │                               │
             └──────────┬────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Music Core Layer                          │
│  `src/music/`                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ PlayerManager │→ │  GuildPlayer  │→ │  QueueManager     │  │
│  │ (per-guild    │  │ (per-guild   │  │ (FIFO, bounded)   │  │
│  │  registry)    │  │  audio state)│  │                    │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────┘  │
│                           │                                  │
│  Track.ts: data model     │                                  │
│  PlayerState.ts: state    │                                  │
│  machine (IDLE→CONNECTING │                                  │
│  →BUFFERING→PLAYING→etc)  │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Audio Pipeline Layer                       │
│  `src/audio/AudioPipeline.ts`                               │
│  Bridges AudioProvider → @discordjs/voice AudioResource      │
│  Spawns FFmpeg for format conversion (→ s16le 48kHz stereo) │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Providers Layer                            │
│  `src/providers/`                                           │
│  AudioProvider (interface)                                   │
│    └─ YouTubeProvider (impl)                                 │
│       - search(query) → yt-dlp ytsearch1:                   │
│       - resolve(url) → yt-dlp --dump-json                   │
│       - createReadStream(track) → yt-dlp stdout pipe        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               External Processes (spawn)                      │
│  yt-dlp → audio stream (pipe) → FFmpeg → raw PCM → voice   │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Entry point | Discord client lifecycle, event routing, shutdown | `src/index.ts` |
| Commands | Slash command definitions and execution | `src/commands/index.ts` |
| Button Interactions | Pause/resume/skip/stop button handling | `src/interactions/musicControls.ts` |
| PlayerManager | Guild-scoped player registry, track resolution, duration enforcement | `src/music/PlayerManager.ts` |
| GuildPlayer | Per-guild audio state machine, voice connection, process lifecycle | `src/music/GuildPlayer.ts` |
| QueueManager | Bounded FIFO queue for pending tracks | `src/music.QueueManager.ts` |
| AudioPipeline | Bridges AudioProvider stream to @discordjs/voice AudioResource | `src/audio/AudioPipeline.ts` |
| AudioProvider | Interface for audio source implementations | `src/providers/AudioProvider.ts` |
| YouTubeProvider | yt-dlp integration for search/resolve/streaming | `src/providers/YouTubeProvider.ts` |
| Track | Data model for a music track | `src/music/Track.ts` |
| PlayerState | State machine type definition | `src/music/PlayerState.ts` |
| Embeds | Discord embed builders for track/queue display | `src/ui/embeds.ts` |
| Controls | Discord button component for music controls | `src/ui/controls.ts` |
| Env config | Typed environment variable parsing | `src/config/env.ts` |
| Logger | Pino logger with redaction | `src/utils/logger.ts` |
| Process util | Safe child_process.spawn with timeout | `src/utils/process.ts` |
| Time util | Duration formatting (seconds → H:MM:SS) | `src/utils/time.ts` |
| Deploy commands | Registers slash commands with Discord API | `src/deploy-commands.ts` |

## Pattern Overview

**Overall:** Monolithic single-package Discord bot with guild-scoped player isolation.

**Key Characteristics:**
- Single `CommandDefinition[]` array — no command loader or file-per-command pattern
- Provider abstraction for audio sources (currently YouTube-only via yt-dlp)
- Pipeline pattern: external process spawning with pipe-based data flow
- Serial execution within each GuildPlayer via `runExclusive()` promise chain
- Environment-driven configuration with typed parsing in `src/config/env.ts`
- All UI strings in French

## Layers

**Entry Point:**
- Purpose: Bootstrap Discord client, route events to handlers
- Location: `src/index.ts`
- Contains: Client creation, InteractionCreate handler, VoiceStateUpdate handler, shutdown logic
- Depends on: commands, interactions, PlayerManager, YouTubeProvider, env, logger
- Used by: Node.js runtime

**Commands Layer:**
- Purpose: Define slash commands and their execution logic
- Location: `src/commands/index.ts`
- Contains: `CommandDefinition` interface, `CommandContext` interface, 10 command definitions (play, testaudio, pause, resume, skip, stop, queue, nowplaying, leave, help), helper functions (memberVoiceChannel, requireControlChannel)
- Depends on: PlayerManager, embeds, controls
- Used by: Entry point (InteractionCreate handler), deploy-commands

**Interactions Layer:**
- Purpose: Handle button interactions for embedded music controls
- Location: `src/interactions/musicControls.ts`
- Contains: `handleMusicControl()` function, button ID routing
- Depends on: PlayerManager, MUSIC_CONTROL_IDS
- Used by: Entry point (InteractionCreate handler)

**Music Core:**
- Purpose: Per-guild audio state management, queue management
- Location: `src/music/`
- Contains: PlayerManager (registry), GuildPlayer (state machine), QueueManager (FIFO), Track (data model), PlayerState (type)
- Depends on: AudioProvider, AudioPipeline, @discordjs/voice, env, logger
- Used by: Commands, Interactions, Entry point

**Audio Pipeline:**
- Purpose: Convert provider audio streams to @discordjs/voice compatible resources
- Location: `src/audio/AudioPipeline.ts`
- Contains: FFmpeg process spawning, stream piping, AudioResource creation
- Depends on: AudioProvider, @discordjs/voice, env, logger
- Used by: GuildPlayer

**Providers Layer:**
- Purpose: Abstract audio source behind a common interface
- Location: `src/providers/`
- Contains: AudioProvider interface, YouTubeProvider implementation
- Depends on: yt-dlp (external process), Track, env, logger, process util
- Used by: AudioPipeline, PlayerManager (for track resolution)

**UI Layer:**
- Purpose: Discord-specific UI components (embeds, buttons)
- Location: `src/ui/`
- Contains: `trackEmbed()`, `queueEmbed()`, `musicControlsRow()`, `MUSIC_CONTROL_IDS`
- Depends on: discord.js
- Used by: Commands, Interactions

**Config:**
- Purpose: Parse and validate environment variables
- Location: `src/config/env.ts`
- Contains: `env` object with typed fields, `required()` and `intEnv()` helpers
- Depends on: process.env
- Used by: Almost every module

**Utils:**
- Purpose: Cross-cutting utilities (logging, process management, time formatting)
- Location: `src/utils/`
- Contains: pino logger, `runProcess()` helper, `formatDuration()`
- Depends on: pino, child_process
- Used by: YouTubeProvider, AudioPipeline, GuildPlayer, UI embeds

## Data Flow

### Primary Request Path (/play)

1. Discord sends InteractionCreate → `src/index.ts:25`
2. Entry point routes to command via `commandMap.get()` → `src/commands/index.ts:45`
3. `play.execute()` validates guild/channel/permissions → `src/commands/index.ts:63-86`
4. `PlayerManager.resolveTrack()` calls YouTubeProvider → `src/music/PlayerManager.ts:37-49`
5. YouTubeProvider spawns yt-dlp with `--dump-json` → `src/providers/YouTubeProvider.ts:122-136`
6. Track metadata returned, duration checked against `MAX_TRACK_DURATION_MINUTES`
7. `PlayerManager.getOrCreate()` returns GuildPlayer → `src/music/PlayerManager.ts:15-24`
8. `GuildPlayer.connect()` joins voice channel → `src/music/GuildPlayer.ts:110-173`
9. `GuildPlayer.add()` either starts immediately or enqueues → `src/music/GuildPlayer.ts:175-187`
10. `GuildPlayer.startTrack()` calls `AudioPipeline.create()` → `src/music/GuildPlayer.ts:314-341`
11. AudioPipeline calls `YouTubeProvider.createReadStream()` → `src/audio/AudioPipeline.ts:17`
12. YouTubeProvider spawns yt-dlp with `-o -` → `src/providers/YouTubeProvider.ts:72-119`
13. AudioPipeline spawns FFmpeg, pipes yt-dlp stdout → FFmpeg → raw PCM → `src/audio/AudioPipeline.ts:19-42`
14. `createAudioResource()` wraps PCM stream → `src/audio/AudioPipeline.ts:82-85`
15. `audioPlayer.play(resource)` starts playback → `src/music/GuildPlayer.ts:327`

### Queue Completion Flow

1. AudioPlayer emits `Idle` → `src/music/GuildPlayer.ts:66-74`
2. `runExclusive` serializes access → `src/music/GuildPlayer.ts:386-390`
3. Kill child processes (yt-dlp, FFmpeg) → `src/music/GuildPlayer.ts:361-366`
4. `playNextInternal()` dequeues next track → `src/music/GuildPlayer.ts:297-312`
5. If queue empty, schedule idle disconnect → `src/music/GuildPlayer.ts:343-349`

### Voice State Update Flow

1. Discord sends VoiceStateUpdate → `src/index.ts:61`
2. Check if bot has a player in this guild → `src/index.ts:63`
3. Count human members in bot's channel → `src/index.ts:69`
4. If 0 humans: `GuildPlayer.handleHumansEmpty()` starts timer → `src/music/GuildPlayer.ts:286-291`
5. If humans present: `GuildPlayer.handleHumansPresent()` clears timer → `src/music/GuildPlayer.ts:293-295`
6. Timer expiry triggers `destroyInternal()` → disconnects and cleans up

**State Management:**
- GuildPlayer state machine: `IDLE → CONNECTING → BUFFERING → PLAYING → PAUSED → STOPPING → ERROR`
- State stored as `_state` field, exposed via `state` getter
- State transitions driven by AudioPlayer events and explicit commands
- Serial execution via `runExclusive()` prevents race conditions on state

## Key Abstractions

**AudioProvider (interface):**
- Purpose: Abstract audio source behind a common contract
- Examples: `src/providers/AudioProvider.ts`, `src/providers/YouTubeProvider.ts`
- Pattern: Strategy pattern — swap YouTubeProvider for another provider without changing AudioPipeline or GuildPlayer

**CommandDefinition (interface):**
- Purpose: Uniform contract for slash commands
- Examples: `src/commands/index.ts:16-19`
- Pattern: Command pattern — each command is a self-contained object with `data` (SlashCommandBuilder) and `execute` method

**GuildPlayer (class):**
- Purpose: Encapsulate all per-guild audio state and operations
- Examples: `src/music/GuildPlayer.ts`
- Pattern: State machine with serial execution — all public methods go through `runExclusive()` to prevent concurrent state mutations

**AudioPipeline (class):**
- Purpose: Transform provider output into Discord-compatible audio resource
- Examples: `src/audio/AudioPipeline.ts`
- Pattern: Pipeline/Adapter — bridges provider streams to @discordjs/voice through FFmpeg transcoding

**PlayerManager (class):**
- Purpose: Registry of per-guild players with lifecycle management
- Examples: `src/music/PlayerManager.ts`
- Pattern: Registry/Map pattern — lazy creation via `getOrCreate()`, cleanup via `destroyAll()`

**env (object):**
- Purpose: Single source of truth for all configuration
- Examples: `src/config/env.ts`
- Pattern: Configuration object — parsed once at startup, imported everywhere as `env`

## Entry Points

**Main Bot (`npm start` / `npm run dev`):**
- Location: `src/index.ts`
- Triggers: Node.js process start
- Responsibilities: Create Discord client, register event handlers, login, handle shutdown

**Command Deploy (`npm run deploy:commands`):**
- Location: `src/deploy-commands.ts`
- Triggers: Manual npm script execution
- Responsibilities: Register slash commands with Discord REST API (guild-scoped or global)

**Tests (`npm test`):**
- Location: `tests/QueueManager.test.ts`, `tests/PlayerManager.test.ts`
- Triggers: vitest runner
- Responsibilities: Unit tests for queue FIFO behavior and player manager guild isolation

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop. All concurrency managed via async/await and promise chains. `runExclusive()` in GuildPlayer serializes state mutations within a guild.
- **Global state:** Single `PlayerManager` instance created in `src/index.ts:19`, passed to commands via `CommandContext.players`. No module-level singletons except `env` and `logger`.
- **External processes:** yt-dlp and FFmpeg spawned as child processes. All processes use `shell: false` and `windowsHide: true`. Processes killed with SIGKILL on skip/stop/destroy.
- **No database:** All state is in-memory. Queue contents lost on restart.
- **No hot reload:** tsx watch used in dev mode, but production runs compiled JS.
- **Single package:** No monorepo, no workspace splitting. All code under `src/`.

## Anti-Patterns

### All commands in single file

**What happens:** All 10 command definitions live in `src/commands/index.ts` (263 lines).
**Why it's wrong:** File will grow linearly with each new command. Hard to review, hard to locate specific command logic.
**Do this instead:** Extract each command to `src/commands/play.ts`, `src/commands/pause.ts`, etc. Keep `index.ts` as a barrel that collects and exports them. Current file size is manageable for MVP.

### Duplicated permission checks across commands

**What happens:** `play` and `testaudio` both independently validate guild, channel, and permissions with identical logic (lines 64-85 and 121-144).
**Why it's wrong:** Copy-paste divergence risk. Any permission check change must be made in multiple places.
**Do this instead:** Extract common validation into a shared helper (similar to `requireControlChannel` which already does this for other commands).

## Error Handling

**Strategy:** Try/catch at handler boundaries with user-friendly French error messages.

**Patterns:**
- Entry point catches all command errors → replies with generic French message (`src/index.ts:48-58`)
- Commands catch their own errors → edit reply with specific message (e.g., `src/commands/index.ts:111-114`)
- GuildPlayer catches track start errors → logs warning, skips to next track (`src/music/GuildPlayer.ts:307-311`)
- External process errors logged via pino, never thrown to user
- All `.catch(() => undefined)` on followUp/reply to prevent unhandled rejection chains

## Cross-Cutting Concerns

**Logging:** Pino (`src/utils/logger.ts`) with level from `LOG_LEVEL` env var. Redacts tokens/authorization headers. Structured logging with guild, track, error context.

**Validation:** Environment variables validated at startup in `src/config/env.ts`. Runtime validation of user input (query non-empty, URL format). Duration limits enforced in `PlayerManager.resolveTrack()`.

**Authentication:** Discord bot token from `DISCORD_TOKEN` env var. No user-level auth beyond Discord's built-in permission system. Commands check `PermissionFlagsBits.Connect` and `PermissionFlagsBits.Speak`.

---

*Architecture analysis: 2026-09-18*
