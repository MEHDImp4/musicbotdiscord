# 🎵 Pulse

> Bot Discord de streaming musical — file d'attente indépendante par serveur, contrôles par boutons, progression en direct, lecture fiable via `yt-dlp` + FFmpeg.

🇫🇷 **Français** · 🇬🇧 [English](./README.en.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A524-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](./Dockerfile)
[![Tests](https://img.shields.io/badge/tests-vitest-6E9F18?logo=vitest&logoColor=white)](./tests)
[![CI](https://github.com/MEHDImp4/pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/MEHDImp4/pulse/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](./CODE_OF_CONDUCT.md)
[![Discussions](https://img.shields.io/badge/Discussions-open-5865F2?logo=discord&logoColor=white)](https://github.com/MEHDImp4/pulse/discussions)

---

## ✨ Fonctionnalités

- 🔎 **Recherche YouTube** ou lecture directe par URL, avec **autocomplétion** sur `/play`
- 📃 **File d'attente par serveur** (aucun mélange entre guildes) avec **pagination**
- 🔁 **Boucle** morceau / file, 🔀 **shuffle**, ⏭ **insertion en tête** (`/playnext`)
- ⏯️ **Contrôles par boutons** : pause, reprise, suivant, stop, vote-skip, volume ±
- 📊 **Progression en direct** dans `/nowplaying` (barre + temps écoulé/total)
- 🗳️ **Vote-skip** majoritaire (min. 2 voix) pour les écoutes en groupe
- 🔊 **Volume réglable** en direct (0–100)
- 🚀 **Fiabilité** : retry automatique des flux, **SponsorBlock**, cookies `yt-dlp`, mise à jour `yt-dlp` au démarrage
- 🛡️ **Anti-spam** : cooldowns par utilisateur et par commande
- 🐳 **Docker prêt pour la prod** : healthcheck, tini (PID 1), arrêt gracieux

## 🎮 Commandes

| Commande | Description |
|---|---|
| `/play query:<texte ou URL>` | Recherche ou ajoute un morceau (autocomplete) |
| `/playnext query:<texte ou URL>` | Insère un morceau juste après le morceau courant |
| `/pause` · `/resume` | Met en pause / reprend la lecture |
| `/skip` | Passe au morceau suivant |
| `/voteskip` | Vote pour passer au morceau suivant |
| `/stop` | Arrête la lecture et vide la file |
| `/queue` | Affiche la file d'attente (paginée) |
| `/nowplaying` | Morceau en cours + barre de progression live |
| `/loop mode:<off\|track\|queue>` | Répétition : désactivée, morceau ou file |
| `/shuffle` | Mélange la file d'attente |
| `/remove position:<n>` | Retire un morceau de la file |
| `/clear` | Vide la file d'attente |
| `/volume level:<0-100>` | Règle le volume (affiche le volume si omis) |
| `/leave` | Déconnecte le bot du salon vocal |
| `/testaudio` | Joue un bip local de 3 s pour tester la voix |
| `/help` | Liste les commandes |

## ✅ Prérequis

- **Node.js 24+**
- **FFmpeg** et **yt-dlp** disponibles dans le `PATH` (inclus dans l'image Docker)
- Un **bot Discord** avec les permissions : *View Channel, Connect, Speak, Send Messages, Embed Links, Use Application Commands*

## 🚀 Démarrage rapide

### Avec Docker (recommandé)

```bash
cp .env.docker.example .env.docker   # renseigne DISCORD_TOKEN et DISCORD_CLIENT_ID
docker compose up -d --build
docker compose logs -f
```

### En local

```bash
npm install
cp .env.example .env                 # renseigne DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID
npm run deploy:commands              # enregistre les slash commands
npm run dev                          # tsx watch
```

En production locale : `npm run build && npm start`.

## ⚙️ Configuration

Toutes les variables sont optionnelles sauf mention contraire.

| Variable | Défaut | Description |
|---|---|---|
| `DISCORD_TOKEN` | — | **Requis.** Token du bot |
| `DISCORD_CLIENT_ID` | — | **Requis.** Application ID |
| `DISCORD_GUILD_ID` | — | Serveur de dev (commandes instantanées). Vide → commandes globales |
| `LOG_LEVEL` | `info` | Niveau de log pino |
| `MAX_QUEUE_SIZE` | `100` | Taille max de la file par serveur |
| `MAX_TRACK_DURATION_MINUTES` | `180` | Durée max d'un morceau (0 = illimité) |
| `MAX_STREAM_RETRIES` | `2` | Tentatives de lecture avant d'abandonner un morceau |
| `IDLE_TIMEOUT_SECONDS` | `300` | Déconnexion auto après inactivité |
| `EMPTY_CHANNEL_TIMEOUT_SECONDS` | `60` | Déconnexion auto quand le salon est vide |
| `COMMAND_COOLDOWN_SECONDS` | `5` | Cooldown anti-spam par défaut |
| `AUTO_DELETE_SECONDS` | `1` | Suppression auto des messages de confirmation (0 = désactivé ; les messages à boutons sont conservés) |
| `SPONSORBLOCK_CATEGORIES` | `sponsor,selfpromo` | Passages ignorés par SponsorBlock |
| `YTDLP_COOKIES_FILE` | — | Cookies `yt-dlp` (vidéos restreintes / anti-bot) |
| `YTDLP_AUTO_UPDATE` | `true` | Met à jour `yt-dlp` au démarrage du conteneur |
| `NOWPLAYING_LIVE` | `true` | Rafraîchit la barre de progression |
| `VOTE_SKIP_MIN` / `VOTE_SKIP_RATIO` | `2` / `0.5` | Seuil du vote-skip |
| `VOLUME_STEP` | `10` | Pas des boutons de volume |
| `AUTOCOMPLETE_ENABLED` | `true` | Autocomplétion sur `/play` |
| `YTDLP_PATH` / `FFMPEG_PATH` | `yt-dlp` / `ffmpeg` | Chemins des binaires |
| `DATA_DIR` | `data` (`/data` en Docker) | Dossier de persistance des réglages par serveur (volume) |

## 🐳 Docker

L'image `node:24-bookworm-slim` embarque FFmpeg et `yt-dlp`, et intègre :

- **`HEALTHCHECK`** basé sur le processus (`pgrep`) → état `healthy`
- **`init: true`** → tini en PID 1 (forward des signaux + reap des zombies)
- **`stop_grace_period: 15s`** → laisse le temps de vider les connexions voix et de tuer les `yt-dlp`
- **Arrêt gracieux** : message « déconnexion », destruction des lecteurs, `SIGTERM → SIGKILL` sur les processus enfants
- **Mise à jour `yt-dlp`** au démarrage (`docker-entrypoint.sh`, non bloquante)

## 🏗️ Architecture

```text
Discord
  ↓
discord.js (Client)
  ↓
PlayerManager ──► GuildPlayer (1 par serveur) + QueueManager
                        ↓
                   AudioPipeline ──► AudioProvider
                        ↓                 ↓
                     FFmpeg         YouTubeProvider ──► yt-dlp
                        ↓
                 @discordjs/voice
                        ↓
                  Discord Voice
```

- `GuildPlayer` détient l'état par serveur : file, mode boucle, volume, votes de skip, message now-playing.
- `decideNext()` (fonction pure) détermine le morceau suivant selon le mode boucle.
- Les **URLs sont validées YouTube** et le **flux direct est résolu juste avant lecture** (évite l'expiration pendant l'attente).
- L'autocomplétion utilise un endpoint de suggestions rapide (jamais `yt-dlp`, trop lent pour la limite de 3 s de Discord).

## 📁 Structure

```text
src/
  commands/        # 1 fichier par commande + barrel + helpers/types
  interactions/    # boutons (musique, pagination queue)
  music/           # GuildPlayer, PlayerManager, QueueManager, decideNext…
  audio/           # AudioPipeline (FFmpeg)
  providers/       # YouTubeProvider (yt-dlp), AudioProvider
  services/        # suggestions (autocomplete), nowPlaying (progress live)
  ui/              # embeds, boutons, barre de progression
  utils/           # logger, cooldown, time, process
  config/          # env
tests/             # vitest (logique pure)
```

## 🧪 Tests

```bash
npm test
```

Couvre la logique pure : opérations de file, `decideNext` (boucle), cooldowns, seuil de vote-skip, barre de progression, parsing des suggestions et isolation des guildes.

## 🔒 Sécurité

- Le token Discord **n'est jamais versionné** (`.env` et `.env.docker` sont ignorés par Git).
- `yt-dlp` et FFmpeg sont lancés via `spawn()` avec une **liste d'arguments** (`shell: false`) — aucune commande shell construite depuis l'entrée utilisateur.
- Les URLs sont validées YouTube avant résolution ; les processus externes ont des timeouts et sont nettoyés à l'arrêt.

## 🛠️ Dépannage

| Symptôme | Piste |
|---|---|
| « An invalid token was provided » | Vérifie `DISCORD_TOKEN` dans `.env.docker` / `.env` |
| Aucun son | Vérifie les permissions *Connect* + *Speak* et les libs opus |
| `yt-dlp` échoue sur certaines vidéos | Fournis `YTDLP_COOKIES_FILE` (vidéos restreintes/anti-bot) |
| Commandes absentes de Discord | `npm run deploy:commands` puis `Ctrl+R` dans Discord |

## 🤝 Contribuer

Les contributions sont bienvenues ! Consulte [CONTRIBUTING.md](./CONTRIBUTING.md) et le [Code de conduite](./CODE_OF_CONDUCT.md) avant d'ouvrir une PR. Pour signaler un bug ou proposer une idée, utilise les [issues](https://github.com/MEHDImp4/pulse/issues) ; pour une question, passe par les [Discussions](https://github.com/MEHDImp4/pulse/discussions). Une faille de sécurité se signale en privé (voir [SECURITY.md](./SECURITY.md)).

## 📄 Licence

[MIT](./LICENSE) © 2026 Mehdi Diouri
