# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Autocomplete on `/play` and `/playnext` (fast suggestion endpoint)
- `/loop` (off / track / queue), `/shuffle`, `/playnext`, `/remove`, `/clear`
- Vote-skip with a majority threshold (`/voteskip` + button)
- Volume controls (command + +/- buttons) and live now-playing progress bar
- Paginated `/queue` with buttons
- Per-user command cooldowns
- Stream retry with channel notification, SponsorBlock, optional yt-dlp cookies
- Automatic yt-dlp update on container start
- Docker hardening: healthcheck, tini (`init`), graceful shutdown
- Community files: code of conduct, security policy, support, governance, contributing
- CI, Dependabot, CodeQL, stale and release automation

### Changed

- Renamed the project to **Pulse**
- Commands are now split one file per command under `src/commands/`

## [0.1.0]

### Added

- Initial MVP: `/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/queue`, `/nowplaying`, `/leave`, `/help`
- Per-guild queue, automatic next track, idle/empty-channel disconnect
- YouTube search/URL playback via yt-dlp + FFmpeg

[Unreleased]: https://github.com/MEHDImp4/pulse/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MEHDImp4/pulse/releases/tag/v0.1.0
