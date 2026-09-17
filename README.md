# Discord Music Bot

Bot Discord de streaming musical destiné à écouter de la musique ensemble dans un salon vocal.

## MVP

- Slash commands Discord
- Recherche YouTube et lecture d'URL YouTube
- File d'attente indépendante par serveur
- Lecture automatique du morceau suivant
- Pause / reprise / skip / stop
- Now Playing et queue
- Déconnexion manuelle et automatique
- TypeScript + Node.js 24+
- `discord.js` + `@discordjs/voice`
- `yt-dlp` + FFmpeg
- Docker

## Commandes

| Commande | Description |
|---|---|
| `/play query:<texte ou URL>` | Recherche ou ajoute un morceau |
| `/pause` | Met en pause |
| `/resume` | Reprend la lecture |
| `/skip` | Passe au morceau suivant |
| `/stop` | Arrête et vide la queue |
| `/queue` | Affiche la file d'attente |
| `/nowplaying` | Affiche le morceau courant |
| `/leave` | Arrête tout et quitte le vocal |
| `/help` | Affiche l'aide |

## Prérequis locaux

- Node.js 24+
- FFmpeg dans le `PATH`
- yt-dlp dans le `PATH`
- Un bot Discord avec les permissions : View Channel, Connect, Speak, Send Messages, Embed Links, Use Application Commands

## Installation locale

```bash
npm install
cp .env.example .env
```

Renseigne `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` et, en développement, `DISCORD_GUILD_ID`.

Enregistre ensuite les slash commands :

```bash
npm run deploy:commands
```

Puis lance le bot :

```bash
npm run dev
```

## Docker

```bash
cp .env.example .env
# renseigner les secrets
docker compose up -d --build
docker compose logs -f
```

## Architecture

```text
Discord
  ↓
discord.js
  ↓
PlayerManager
  ↓
GuildPlayer + QueueManager
  ↓
AudioProvider
  ↓
YouTubeProvider
  ↓
yt-dlp
  ↓
FFmpeg
  ↓
@discordjs/voice
  ↓
Discord Voice
```

La queue conserve l'URL YouTube d'origine. L'URL directe du flux est résolue uniquement juste avant la lecture pour éviter son expiration pendant l'attente.

## Sécurité

- Le token Discord n'est jamais stocké dans Git.
- `.env` est ignoré.
- `yt-dlp` et FFmpeg sont lancés avec `spawn()` et une liste d'arguments ; aucune commande shell n'est construite avec l'entrée utilisateur.
- Les URLs YouTube sont validées avant résolution.
- Les processus externes utilisent des timeouts et sont nettoyés.

## Tests

```bash
npm test
```

Les tests couvrent notamment la queue FIFO et la séparation logique entre plusieurs guildes.

## Roadmap

Après validation du MVP : boutons Discord, volume, shuffle/repeat, playlists YouTube, métadonnées Spotify, playlists persistantes, Lavalink et dashboard web.
