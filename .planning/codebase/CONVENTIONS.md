# Coding Conventions

**Analysis Date:** 2026-09-18

## Naming Patterns

**Files:**
- PascalCase for class-based modules: `GuildPlayer.ts`, `QueueManager.ts`, `YouTubeProvider.ts`, `AudioPipeline.ts`
- camelCase for utility/helper modules: `env.ts`, `logger.ts`, `time.ts`, `process.ts`
- kebab-case for entry points and scripts: `index.ts`, `deploy-commands.ts`, `musicControls.ts`
- Test files use `*.test.ts` suffix: `QueueManager.test.ts`, `PlayerManager.test.ts`

**Functions:**
- camelCase: `formatDuration()`, `runProcess()`, `handleMusicControl()`, `memberVoiceChannel()`
- Private methods use camelCase without prefix: `playNextInternal()`, `startTrack()`, `destroyInternal()`
- Helper/conversion functions: `toTrack()`, `commonArgs()`, `intEnv()`, `required()`

**Variables:**
- camelCase for local variables and parameters: `maxOutputBytes`, `ffmpegStderr`, `requestedBy`
- Private class fields use underscore prefix for backing fields: `_currentTrack`, `_state`
- Private fields without backing use no prefix: `connection`, `childProcesses`, `destroyed`
- Constants use camelCase (not UPPER_SNAKE): `CONTROL_IDS`, `MUSIC_CONTROL_IDS`
- Readonly class fields use `readonly` modifier: `readonly guildId`, `readonly queue`

**Types:**
- PascalCase for interfaces and types: `Track`, `PlayerState`, `CommandContext`, `AudioProvider`
- Interfaces for contracts: `AudioProvider`, `CommandDefinition`, `RunProcessOptions`
- Type literals for enums: `PlayerState = "IDLE" | "CONNECTING" | ...` (no enum keyword)
- `as const` for frozen objects: `env` object, `MUSIC_CONTROL_IDS`

## Code Style

**Formatting:**
- No linter or formatter configured (no `.eslintrc`, `.prettierrc`, or `biome.json`)
- Consistent style suggests manual adherence:
  - 2-space indentation
  - Double quotes for strings
  - Trailing commas in multi-line arrays/objects
  - Semicolons at end of statements

**Linting:**
- No linter configured — `tsc` (TypeScript compiler) is the only static check
- Run via `npm run build` (which runs `tsc -p tsconfig.json`)

**TypeScript Configuration:**
- `strict: true` in `tsconfig.json` — all strict checks enabled
- Target: ES2022, Module: CommonJS
- `esModuleInterop: true`, `skipLibCheck: true`
- No path aliases — all imports use relative paths

## Import Organization

**Order:**
1. Node.js built-in modules (`node:child_process`, `node:stream`)
2. External packages (`discord.js`, `@discordjs/voice`, `pino`, `vitest`)
3. Internal modules using relative paths (`../config/env`, `../utils/logger`)

**Path Aliases:**
- None — all imports use relative paths (`../`, `./`)

**Type Imports:**
- Use `import type` for type-only imports: `import type { Track } from "../music/Track"`
- Mixed imports when both value and type needed: `import { Client, Events, type GatewayIntentBits } from "discord.js"`

## Error Handling

**Patterns:**
- Try/catch at command boundary — catch errors and reply with user-friendly French message prefixed with `❌`
- Errors logged with pino structured logging: `logger.error({ err: error, command: ... }, "message")`
- Non-critical fire-and-forget operations use `.catch(() => undefined)` to suppress unhandled rejection
- Error messages exposed to users are sanitized — only `error.message` shown, never stack traces
- Process spawn errors handled via event listeners (`child.on("error", ...)`)
- Timeout handling via `setTimeout` + `SIGKILL` pattern in `runProcess()`

**Error Message Convention:**
- User-facing: French text with `❌` prefix for errors, `ℹ️` for info, emoji prefixes for success states
- Internal: English text in log messages

## Logging

**Framework:** pino (`src/utils/logger.ts`)

**Patterns:**
- Structured logging with context objects: `logger.info({ guild: guildId, track: title }, "message")`
- Sensitive data redacted via pino redact config: `token`, `discordToken`, `authorization`, `headers.authorization`
- Log levels: `debug` for protocol details, `info` for state changes, `warn` for recoverable issues, `error` for failures, `fatal` for startup failures
- External process stderr captured and logged: yt-dlp, FFmpeg output logged at debug level

**When to Log:**
- State transitions (player status changes, voice connection changes)
- External process lifecycle (spawn, error, close with exit code)
- Command execution failures
- Startup/shutdown events

## Comments

**When to Comment:**
- Minimal inline comments — code is self-documenting
- No JSDoc/TSDoc on functions or interfaces
- No TODO/FIXME markers found in codebase

**Style:**
- Comments rare; when present, they explain non-obvious logic (e.g., URL validation in `YouTubeProvider.ts`)

## Function Design

**Size:** Functions are kept short and focused — most under 30 lines. `GuildPlayer` class is the largest at 391 lines but each method is small.

**Parameters:** Functions accept specific interfaces rather than loose objects. Example: `runProcess(executable, args, options)` where `options` is typed as `RunProcessOptions`.

**Return Values:**
- Explicit return types on public methods: `Promise<void>`, `Promise<boolean>`, `Promise<Track>`
- Use `void` for fire-and-forget async: `void this.runExclusive(...)`
- Optional chaining for nullable returns: `player?.currentTrack`

**Async Pattern:**
- All I/O operations are async/await
- Serial execution via `runExclusive()` mutex pattern in `GuildPlayer` — prevents concurrent state mutations
- Promise-based process spawning via `runProcess()` utility

## Module Design

**Exports:**
- Named exports only — no default exports anywhere in codebase
- Classes exported with `export class`: `PlayerManager`, `GuildPlayer`, `QueueManager`
- Interfaces exported with `export interface`: `AudioProvider`, `CommandContext`, `Track`
- Functions exported with `export function`: `formatDuration()`, `runProcess()`, `handleMusicControl()`
- Constants exported with `export const`: `env`, `logger`, `MUSIC_CONTROL_IDS`, `commandMap`

**Barrel Files:**
- `src/commands/index.ts` serves as barrel — exports `commands` array and `commandMap`
- No other barrel files; each module exports directly

**Composition:**
- Dependency injection via constructor: `PlayerManager(provider)`, `GuildPlayer(guildId, provider, onDestroyed)`
- Provider pattern: `AudioProvider` interface with `YouTubeProvider` implementation
- Context object pattern for command dependencies: `CommandContext { players: PlayerManager }`

---

*Convention analysis: 2026-09-18*
