# Codebase Structure

**Analysis Date:** 2026-09-18

## Directory Layout

```
musicbotdiscord/
├── src/                    # Application source code
│   ├── audio/              # Audio processing pipeline
│   ├── commands/           # Slash command definitions
│   ├── config/             # Environment configuration
│   ├── interactions/       # Button interaction handlers
│   ├── music/              # Core music playback logic
│   ├── providers/          # Audio source abstractions
│   ├── ui/                 # Discord UI components (embeds, buttons)
│   ├── utils/              # Cross-cutting utilities
│   ├── deploy-commands.ts  # Discord API command registration script
│   └── index.ts            # Application entry point
├── tests/                  # Test files (vitest)
├── docs/                   # Project documentation
├── .planning/              # GSD planning artifacts
│   └── codebase/           # Codebase analysis documents
├── .env                    # Environment variables (gitignored)
├── .env.example            # Example environment config
├── docker-compose.yml      # Docker Compose config
├── Dockerfile              # Docker build definition
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vitest.config.ts        # Vitest test runner configuration
└── yt-dlp.exe              # yt-dlp binary (Windows, gitignored)
```

## Directory Purposes

**`src/audio/`:**
- Purpose: Audio stream processing and format conversion
- Contains: `AudioPipeline.ts` — bridges AudioProvider output to @discordjs/voice
- Key files: `AudioPipeline.ts`

**`src/commands/`:**
- Purpose: Slash command definitions and execution logic
- Contains: All commands in a single `CommandDefinition[]` array
- Key files: `index.ts` (263 lines — all 10 commands + helpers)

**`src/config/`:**
- Purpose: Typed environment variable parsing and validation
- Contains: `env.ts` — `env` object with all config fields
- Key files: `env.ts`

**`src/interactions/`:**
- Purpose: Non-command interaction handlers (buttons)
- Contains: `musicControls.ts` — pause/resume/skip/stop button handler
- Key files: `musicControls.ts`

**`src/music/`:**
- Purpose: Core music playback state management
- Contains: PlayerManager (guild registry), GuildPlayer (state machine), QueueManager (FIFO), Track (data model), PlayerState (type)
- Key files: `GuildPlayer.ts` (391 lines — largest file), `PlayerManager.ts`, `QueueManager.ts`, `Track.ts`, `PlayerState.ts`

**`src/providers/`:**
- Purpose: Audio source abstraction layer
- Contains: `AudioProvider` interface, `YouTubeProvider` implementation (yt-dlp)
- Key files: `AudioProvider.ts`, `YouTubeProvider.ts`

**`src/ui/`:**
- Purpose: Discord-specific UI components
- Contains: Embed builders for track/queue display, button row for music controls
- Key files: `embeds.ts`, `controls.ts`

**`src/utils/`:**
- Purpose: Cross-cutting utilities
- Contains: Logger (pino), process spawner, time formatter
- Key files: `logger.ts`, `process.ts`, `time.ts`

**`tests/`:**
- Purpose: Unit tests
- Contains: `QueueManager.test.ts`, `PlayerManager.test.ts`, `setup.ts` (env stubs)
- Key files: `QueueManager.test.ts`, `PlayerManager.test.ts`

**`docs/`:**
- Purpose: Project documentation
- Contains: `CAHIER_DES_CHARGES.md` (specification document)
- Key files: `CAHIER_DES_CHARGES.md`

## Key File Locations

**Entry Points:**
- `src/index.ts`: Main bot process — creates Discord client, routes events, handles shutdown
- `src/deploy-commands.ts`: Registers slash commands with Discord API

**Configuration:**
- `src/config/env.ts`: All environment variables with types and defaults
- `package.json`: Dependencies, scripts, engine requirements
- `tsconfig.json`: TypeScript compiler options (ES2022 target, CommonJS modules, strict)
- `vitest.config.ts`: Test runner configuration

**Core Logic:**
- `src/music/GuildPlayer.ts`: Per-guild audio state machine — largest and most complex file (391 lines)
- `src/music/PlayerManager.ts`: Guild player registry and track resolution
- `src/audio/AudioPipeline.ts`: yt-dlp → FFmpeg → @discordjs/voice bridge
- `src/providers/YouTubeProvider.ts`: yt-dlp integration (search, resolve, stream)

**Testing:**
- `tests/QueueManager.test.ts`: Queue FIFO and limits
- `tests/PlayerManager.test.ts`: Guild isolation and track resolution
- `tests/setup.ts`: Environment variable stubs for tests

## Naming Conventions

**Files:**
- PascalCase for classes and primary exports: `GuildPlayer.ts`, `AudioPipeline.ts`, `QueueManager.ts`, `PlayerManager.ts`, `PlayerState.ts`, `Track.ts`
- camelCase for non-class modules: `env.ts`, `controls.ts`, `embeds.ts`, `logger.ts`, `process.ts`, `time.ts`, `musicControls.ts`
- kebab-case for scripts: `deploy-commands.ts`
- Test files: `*.test.ts` suffix

**Directories:**
- lowercase singular: `music/`, `commands/`, `providers/`, `utils/`, `ui/`, `config/`, `audio/`, `interactions/`

**Exports:**
- Named exports for classes and functions: `export class GuildPlayer`, `export function trackEmbed`
- Default exports: Not used
- Interfaces: PascalCase without `I` prefix (`AudioProvider`, `CommandDefinition`, `CommandContext`)
- Types: PascalCase (`PlayerState`, `Track`, `RequestedBy`)
- Constants: UPPER_SNAKE_CASE (`MUSIC_CONTROL_IDS`)
- Private fields: `_` prefix for backing fields (`_currentTrack`, `_state`)

## Where to Add New Code

**New Slash Command:**
- Implementation: `src/commands/index.ts` — add to `commands` array (currently all in one file)
- Testing: `tests/` — add `CommandName.test.ts` if logic is complex
- Registration: Automatically handled by `deploy-commands.ts` since it reads from the `commands` array
- Note: All commands currently live in `index.ts`. For >15 commands, extract to individual files.

**New Button Interaction:**
- Implementation: `src/interactions/musicControls.ts` — add case to switch, add ID to `MUSIC_CONTROL_IDS` in `src/ui/controls.ts`
- UI component: `src/ui/controls.ts` — add button to `musicControlsRow()`

**New Audio Provider:**
- Interface: Implement `src/providers/AudioProvider.ts`
- Registration: Pass to `PlayerManager` constructor in `src/index.ts`
- Example: Create `SpotifyProvider.ts` implementing `search()`, `resolve()`, `createReadStream()`

**New Configuration Variable:**
- Add to `src/config/env.ts` — use `required()` for mandatory, `intEnv()` for integers with defaults
- Document in `.env.example`

**New Utility Function:**
- Shared helpers: `src/utils/` — create new file or add to existing
- Keep utilities pure (no side effects, no Discord dependencies)

**New Music Feature:**
- Core logic: `src/music/` — add new class or extend existing
- State changes: Update `PlayerState` type in `src/music/PlayerState.ts`
- UI updates: Update embeds in `src/ui/embeds.ts`

## Special Directories

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (by `npm install`)
- Committed: No

**`dist/`:**
- Purpose: Compiled TypeScript output
- Generated: Yes (by `tsc`)
- Committed: No

**`.planning/`:**
- Purpose: GSD planning artifacts and codebase analysis
- Generated: Yes (by GSD tools)
- Committed: Yes

**`tests/`:**
- Purpose: Unit test files
- Generated: No
- Committed: Yes

## File Size Reference

| File | Lines | Notes |
|------|-------|-------|
| `src/music/GuildPlayer.ts` | 391 | Largest — state machine, voice connection, process management |
| `src/commands/index.ts` | 263 | All commands in one file — will grow with each new command |
| `src/providers/YouTubeProvider.ts` | 137 | yt-dlp integration |
| `src/utils/process.ts` | 82 | Safe process spawner |
| `src/interactions/musicControls.ts` | 80 | Button handler |
| `src/audio/AudioPipeline.ts` | 89 | FFmpeg bridging |
| `src/music/PlayerManager.ts` | 54 | Guild player registry |
| `src/ui/embeds.ts` | 44 | Discord embeds |
| `src/ui/controls.ts` | 37 | Button components |
| `src/music/QueueManager.ts` | 35 | FIFO queue |
| `src/config/env.ts` | 31 | Configuration parsing |
| `src/index.ts` | 86 | Entry point |
| `src/deploy-commands.ts` | 21 | Command registration |
| `src/music/Track.ts` | 15 | Data model |
| `src/utils/logger.ts` | 10 | Logger setup |
| `src/utils/time.ts` | 9 | Duration formatting |
| `src/music/PlayerState.ts` | 8 | State type |
| `src/providers/AudioProvider.ts` | 8 | Interface |

---

*Structure analysis: 2026-09-18*
