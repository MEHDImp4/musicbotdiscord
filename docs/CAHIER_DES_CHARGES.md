# CAHIER DES CHARGES

## Bot Discord de streaming musical — MVP

**Version :** 1.0
**Date :** Septembre 2026
**Type de projet :** Bot Discord personnel / communautaire
**Plateforme cible :** Discord
**Langage principal :** TypeScript
**Environnement :** Node.js
**Source musicale initiale :** YouTube
**Déploiement cible :** Docker / serveur personnel

---

# 1. Présentation du projet

## 1.1 Contexte

Lors d'une conversation vocale sur Discord, plusieurs utilisateurs souhaitent pouvoir écouter de la musique ensemble directement dans leur salon vocal.

L'objectif est de développer un bot Discord capable de rejoindre automatiquement le salon vocal d'un utilisateur et d'y diffuser de la musique.

Le bot doit permettre de rechercher une musique ou de fournir directement une URL, puis gérer automatiquement la lecture, la file d'attente et les principales commandes de contrôle.

Le projet doit commencer par un MVP simple et fiable avant d'intégrer des fonctionnalités plus avancées telles que Spotify, les playlists persistantes, Lavalink ou un dashboard web.

---

# 2. Objectif principal

Développer un bot Discord permettant à plusieurs personnes présentes dans un même salon vocal d'écouter de la musique ensemble.

Le scénario principal est :

```text
Utilisateur rejoint un vocal
        ↓
/play Daft Punk Get Lucky
        ↓
Bot rejoint automatiquement le vocal
        ↓
Recherche YouTube
        ↓
Résolution de la source audio
        ↓
FFmpeg
        ↓
Discord Voice
        ↓
Tous les utilisateurs entendent la musique

```

---

# 3. Objectifs du MVP

Le MVP doit permettre de :

- connecter automatiquement le bot à un salon vocal ;
- rechercher une musique à partir de son nom ;
- lire une URL YouTube ;
- diffuser uniquement l'audio ;
- ajouter plusieurs morceaux dans une file d'attente ;
- passer au morceau suivant ;
- mettre en pause ;
- reprendre la lecture ;
- arrêter la lecture ;
- consulter la file d'attente ;
- consulter le morceau actuellement joué ;
- gérer correctement les erreurs ;
- quitter automatiquement le salon lorsqu'il n'est plus utilisé.

---

# 4. Périmètre fonctionnel

## 4.1 Inclus dans le MVP

Le MVP inclut :

- Discord Slash Commands ;
- connexion aux salons vocaux ;
- streaming audio ;
- YouTube ;
- recherche par texte ;
- URL YouTube ;
- file d'attente ;
- lecture automatique du morceau suivant ;
- pause ;
- reprise ;
- skip ;
- stop ;
- affichage du morceau courant ;
- affichage de la queue ;
- déconnexion ;
- gestion multi-serveurs Discord ;
- logs ;
- Docker ;
- configuration par variables d'environnement.

---

# 5. Hors périmètre du MVP

Les éléments suivants ne doivent pas être développés pendant la première version :

- dashboard web ;
- application mobile ;
- Spotify comme source audio directe ;
- Apple Music ;
- Deezer ;
- SoundCloud ;
- authentification utilisateur externe ;
- playlists persistantes ;
- système de comptes ;
- historique permanent ;
- base de données ;
- recommandations IA ;
- autoplay ;
- paroles synchronisées ;
- égaliseur ;
- vote skip ;
- système premium ;
- Lavalink ;
- clustering ;
- sharding Discord ;
- téléchargement des musiques ;
- stockage permanent des fichiers audio.

Ces fonctionnalités pourront être ajoutées ultérieurement.

---

# 6. Utilisateurs concernés

## Utilisateur Discord

Peut :

- demander une musique ;
- consulter la queue ;
- contrôler la lecture ;
- ajouter des morceaux.

## Administrateur Discord

Peut utiliser les mêmes fonctionnalités.

Des permissions administratives supplémentaires pourront être introduites ultérieurement.

## Bot

Le bot doit :

- recevoir les commandes ;
- rejoindre le vocal ;
- gérer la queue ;
- récupérer la source musicale ;
- transcoder l'audio ;
- transmettre l'audio à Discord ;
- gérer son état ;
- gérer automatiquement les erreurs.

---

# 7. Architecture technique

Architecture proposée :

```text
┌─────────────────────────┐
│         Discord         │
│ Slash Commands + Voice  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│      Discord Client     │
│       discord.js        │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│      Command Handler    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│      Music Service      │
│                        │
│ GuildPlayer             │
│ QueueManager            │
│ PlayerManager           │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Audio Source Layer    │
│                        │
│ YouTubeProvider         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│         yt-dlp          │
│ Search + Stream URL     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│         FFmpeg          │
│ Audio processing        │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   @discordjs/voice      │
└────────────┬────────────┘
             │
             ▼
        Discord Voice

```

---

# 8. Stack technique

## Backend

- Node.js 24+
- TypeScript

## Discord

- discord.js
- @discordjs/voice

## Audio

- FFmpeg
- @discordjs/opus

## Source musicale

- yt-dlp

## Logs

Bibliothèque recommandée :

- Pino

ou équivalent.

## Déploiement

- Docker
- Docker Compose

---

# 9. Principe important d'architecture

La récupération de musique ne doit pas être directement intégrée dans le MusicPlayer.

Créer une abstraction :

```text
AudioProvider

```

Interface conceptuelle :

```ts
interface AudioProvider {
    search(query: string): Promise<Track>;
    resolve(url: string): Promise<Track>;
    getStream(track: Track): Promise<AudioStream>;
}

```

Implémentation MVP :

```text
AudioProvider
     │
     └── YouTubeProvider

```

À l'avenir :

```text
AudioProvider
 ├── YouTubeProvider
 ├── SoundCloudProvider
 ├── LocalProvider
 └── LavalinkProvider

```

Ainsi, le système de lecture Discord ne dépend pas directement de YouTube.

---

# 10. Gestion multi-serveurs

Le bot doit être capable d'être présent dans plusieurs serveurs Discord.

Chaque serveur possède son propre :

- player ;
- salon vocal ;
- morceau actuel ;
- queue ;
- état de lecture.

Structure logique :

```ts
Map<GuildId, GuildPlayer>

```

Exemple :

```text
Guild A
 ├─ Vocal #general
 ├─ Song A
 └─ Queue A

Guild B
 ├─ Vocal #music
 ├─ Song X
 └─ Queue B

```

Les queues de deux serveurs ne doivent jamais être mélangées.

---

# 11. Objet Track

Chaque musique doit être représentée par un objet interne.

Exemple :

```ts
interface Track {
    id: string;
    title: string;
    webpageUrl: string;
    thumbnail?: string;
    duration?: number;
    author?: string;

    requestedBy: {
        id: string;
        username: string;
    };

    provider: "youtube";
}

```

Important :

La queue ne doit pas stocker uniquement une URL temporaire du flux audio.

Elle doit conserver l'URL originale de la vidéo.

La source audio réelle doit être résolue juste avant la lecture.

Cela évite qu'une URL temporaire expire pendant qu'elle attend longtemps dans la queue.

---

# 12. Gestion d'une queue

Chaque serveur possède :

```ts
class GuildQueue {
    currentTrack?: Track;
    tracks: Track[];
}

```

Exemple :

```text
Currently Playing

Daft Punk — Get Lucky

Queue

1. Starboy
2. Blinding Lights
3. One More Time
4. Instant Crush

```

---

# 13. Fonctionnalités détaillées

## FR-01 — Connexion automatique

Lorsqu'un utilisateur lance :

```text
/play

```

le bot doit vérifier dans quel salon vocal se trouve cet utilisateur.

Si un salon est trouvé :

```text
Bot → Join Voice Channel

```

Sinon :

```text
❌ Tu dois être dans un salon vocal pour utiliser cette commande.

```

---

# 14. FR-02 — Recherche musicale

Commande :

```text
/play <recherche>

```

Exemple :

```text
/play Daft Punk Get Lucky

```

Le système doit :

1. recevoir la recherche ;
2. envoyer la recherche au YouTubeProvider ;
3. récupérer le premier résultat pertinent ;
4. récupérer les métadonnées ;
5. créer un objet Track ;
6. démarrer la musique ou l'ajouter à la queue.

---

# 15. FR-03 — Lecture d'une URL

Exemple :

```text
/play https://www.youtube.com/watch?v=...

```

Le bot détecte automatiquement qu'il s'agit d'une URL.

Il doit :

1. vérifier la validité ;
2. récupérer les informations ;
3. créer le Track ;
4. l'ajouter au player.

---

# 16. FR-04 — Lecture immédiate

Si aucune musique n'est en cours :

```text
/play Music A

```

doit provoquer :

```text
resolve Music A
     ↓
create stream
     ↓
FFmpeg
     ↓
Discord AudioPlayer
     ↓
PLAYING

```

---

# 17. FR-05 — Queue

Si une musique est déjà en cours :

```text
/play Music B

```

Music B doit être ajoutée à la queue.

Le morceau actuel ne doit pas être interrompu.

Réponse :

```text
✅ Ajouté à la file d'attente

🎵 Music B
Position : #2

```

---

# 18. FR-06 — Lecture automatique suivante

Lorsqu'un morceau se termine :

```text
Track Finished
      ↓
Remove Track
      ↓
Get Queue[0]
      ↓
Resolve Stream
      ↓
Play Next

```

Aucune intervention utilisateur ne doit être nécessaire.

---

# 19. Commande /play

Syntaxe :

```text
/play query:<texte ou URL>

```

Exemples :

```text
/play query:Get Lucky Daft Punk

```

```text
/play query:https://youtube.com/...

```

---

# 20. Commande /pause

Commande :

```text
/pause

```

Effet :

```text
PLAYING → PAUSED

```

Réponse :

```text
⏸ Lecture mise en pause.

```

---

# 21. Commande /resume

Commande :

```text
/resume

```

Effet :

```text
PAUSED → PLAYING

```

---

# 22. Commande /skip

Commande :

```text
/skip

```

Elle doit :

1. arrêter le morceau actuel ;
2. passer au suivant ;
3. lancer automatiquement la prochaine musique.

Si aucune musique suivante :

```text
⏭ Morceau ignoré.

La file d'attente est maintenant vide.

```

---

# 23. Commande /stop

Commande :

```text
/stop

```

Elle doit :

- arrêter la musique ;
- vider toute la queue.

Le bot peut rester temporairement dans le vocal.

---

# 24. Commande /queue

Commande :

```text
/queue

```

Affichage :

```text
🎶 FILE D'ATTENTE

En cours

Get Lucky
Daft Punk
6:09

À suivre

1. Starboy — The Weeknd
2. Instant Crush — Daft Punk
3. Blinding Lights — The Weeknd

3 morceaux

```

Pour les longues queues, une pagination pourra être ajoutée.

---

# 25. Commande /nowplaying

Commande :

```text
/nowplaying

```

Affiche :

- miniature ;
- titre ;
- artiste/chaîne ;
- durée ;
- utilisateur ayant demandé la musique ;
- état pause/lecture.

Exemple :

```text
🎵 NOW PLAYING

Daft Punk — Get Lucky

Duration: 6:09
Requested by: Mehdi

```

---

# 26. Commande /leave

Commande :

```text
/leave

```

Le bot doit :

1. arrêter le player ;
2. vider la queue ;
3. détruire la connexion vocale ;
4. supprimer le GuildPlayer associé.

---

# 27. Commande /help

Une commande :

```text
/help

```

peut afficher :

```text
/play
/pause
/resume
/skip
/stop
/queue
/nowplaying
/leave

```

---

# 28. Interface Discord

Les réponses importantes doivent utiliser des Discord Embeds.

Exemple :

```text
┌─────────────────────────────┐
│ 🎵 NOW PLAYING              │
│                             │
│ Daft Punk — Get Lucky       │
│                             │
│ Duration       6:09         │
│ Requested by   Mehdi        │
└─────────────────────────────┘

```

---

# 29. Boutons Discord

Les boutons peuvent être intégrés au MVP si leur implémentation reste simple.

Sous le Now Playing :

```text
[ ⏸ Pause ] [ ⏭ Skip ] [ ⏹ Stop ]

```

Puis éventuellement :

```text
[ 🔀 Shuffle ] [ 🔁 Repeat ]

```

Shuffle et Repeat ne sont cependant pas obligatoires pour valider le MVP.

---

# 30. Gestion des salons vocaux

Un utilisateur contrôlant la musique doit normalement être présent dans le même salon vocal que le bot.

Exemple :

```text
Bot → #Music
Mehdi → #Music

```

Commande autorisée.

Mais :

```text
Bot → #Music
Mehdi → #Gaming

```

Commande de contrôle refusée.

Message :

```text
❌ Tu dois être dans le même salon vocal que le bot.

```

---

# 31. Déconnexion automatique

Lorsque la queue devient vide, le bot peut attendre :

```text
5 minutes

```

avant de quitter automatiquement.

Variable :

```env
IDLE_TIMEOUT_SECONDS=300

```

Si une nouvelle musique est demandée pendant ce délai :

```text
timer cancelled

```

---

# 32. Salon vide

Si tous les humains quittent le salon vocal :

```text
Humans = 0

```

le bot doit attendre un court délai.

Exemple :

```text
60 secondes

```

Puis :

- arrêter le morceau ;
- vider la queue ;
- quitter le vocal.

---

# 33. Audio

Le bot ne doit récupérer que l'audio nécessaire à la diffusion.

Chaîne :

```text
YouTube
   ↓
yt-dlp
   ↓
audio stream
   ↓
FFmpeg
   ↓
Opus
   ↓
Discord

```

Le MVP ne doit pas télécharger entièrement la vidéo avant de commencer la lecture.

La diffusion doit commencer dès qu'un flux exploitable est disponible.

---

# 34. FFmpeg

FFmpeg est chargé de :

- traiter le flux audio ;
- gérer les formats ;
- produire un flux exploitable par Discord.

Il doit être installé dans l'image Docker.

---

# 35. yt-dlp

yt-dlp doit être isolé derrière le YouTubeProvider.

Le code métier ne doit pas dépendre directement de ses commandes.

Créer par exemple :

```text
services/providers/YoutubeProvider.ts

```

Le provider est responsable de :

- recherche ;
- métadonnées ;
- validation URL ;
- résolution audio.

---

# 36. Gestion des processus externes

FFmpeg et yt-dlp doivent être lancés avec des API sécurisées de création de processus.

Préférer :

```ts
spawn()

```

avec une liste d'arguments.

Éviter de construire des commandes shell contenant directement le texte fourni par l'utilisateur.

Exemple à éviter :

```ts
exec(`yt-dlp ${userInput}`)

```

Cela permet notamment d'éviter des injections de commandes.

---

# 37. Limites utilisateur

Pour éviter les abus, prévoir :
```env
MAX_QUEUE_SIZE=100
MAX_TRACK_DURATION_MINUTES=180

```

Par exemple :

- maximum 100 morceaux ;
- maximum 3 heures par morceau.

Ces valeurs doivent être configurables.

---

# 38. Concurrence

Deux utilisateurs peuvent envoyer `/play` presque simultanément.

Le système doit empêcher :

- double démarrage ;
- queue corrompue ;
- deux streams simultanés accidentels.

Les opérations importantes du GuildPlayer doivent être sérialisées.

---

# 39. États du player

Le player peut avoir les états :

```text
IDLE
CONNECTING
BUFFERING
PLAYING
PAUSED
STOPPING
ERROR

```

Transitions principales :

```text
IDLE
 ↓
CONNECTING
 ↓
BUFFERING
 ↓
PLAYING
 ↔
PAUSED
 ↓
IDLE

```

---

# 40. Gestion des erreurs

Le bot ne doit jamais crash entièrement à cause d'une musique.

Cas à traiter :

### URL invalide

```text
❌ Cette URL n'est pas valide.

```

### Vidéo inexistante

```text
❌ Impossible de trouver cette vidéo.

```

### Vidéo indisponible

```text
❌ Cette vidéo n'est pas disponible.

```

### Aucun résultat

```text
❌ Aucun résultat trouvé.

```

### Erreur audio

Le morceau doit être ignoré si possible.

```text
⚠️ Impossible de lire ce morceau.
Passage au suivant...

```

### Bot sans permission

```text
❌ Je n'ai pas la permission de rejoindre ou parler dans ce salon.

```

### Utilisateur hors vocal

```text
❌ Rejoins d'abord un salon vocal.

```

---

# 41. Timeout

Les opérations externes doivent avoir un timeout.

Par exemple :

```text
Search timeout
Resolve timeout
FFmpeg startup timeout
Voice connection timeout

```

Une opération externe bloquée ne doit pas bloquer le bot indéfiniment.

---

# 42. Retry

Certaines erreurs réseau peuvent être retentées.

Exemple :

```text
Resolve Stream

Attempt 1 → Failed
Attempt 2 → Failed
Attempt 3 → Success

```

Limiter le nombre de tentatives.

Par exemple :

```env
MAX_STREAM_RETRIES=2

```

---

# 43. Permissions Discord

Permissions minimales nécessaires :

- View Channel ;
- Connect ;
- Speak ;
- Send Messages ;
- Embed Links ;
- Use Application Commands.

Le bot ne doit pas recevoir Administrator sauf nécessité particulière.

---

# 44. Discord Gateway Intents

Comme les commandes passent par les interactions Discord, éviter les intents inutiles.

Prévoir principalement :

```ts
GatewayIntentBits.Guilds
GatewayIntentBits.GuildVoiceStates

```

L'intent MessageContent ne doit pas être nécessaire pour le MVP.

---

# 45. Sécurité des secrets

Ne jamais stocker le token Discord dans Git.

Utiliser :

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=

```

Le fichier :

```text
.env

```

doit être présent dans :

```text
.gitignore

```

---

# 46. Configuration

Exemple de `.env.example` :

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=

# Développement uniquement
DISCORD_GUILD_ID=

LOG_LEVEL=info

IDLE_TIMEOUT_SECONDS=300
EMPTY_CHANNEL_TIMEOUT_SECONDS=60

MAX_QUEUE_SIZE=100
MAX_TRACK_DURATION_MINUTES=180
MAX_STREAM_RETRIES=2

YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg

```

---

# 47. Enregistrement des commandes

En développement :

```text
Guild Commands

```

afin que les modifications soient disponibles rapidement.

En production :

```text
Global Application Commands

```

---

# 48. Structure du projet

Architecture recommandée :

```text
discord-music-bot/
│
├── src/
│   │
│   ├── commands/
│   │   ├── play.ts
│   │   ├── pause.ts
│   │   ├── resume.ts
│   │   ├── skip.ts
│   │   ├── stop.ts
│   │   ├── queue.ts
│   │   ├── nowplaying.ts
│   │   ├── leave.ts
│   │   └── help.ts
│   │
│   ├── discord/
│   │   ├── client.ts
│   │   ├── commands.ts
│   │   └── events.ts
│   │
│   ├── music/
│   │   ├── GuildPlayer.ts
│   │   ├── PlayerManager.ts
│   │   ├── QueueManager.ts
│   │   ├── Track.ts
│   │   └── PlayerState.ts
│   │
│   ├── providers/
│   │   ├── AudioProvider.ts
│   │   └── YouTubeProvider.ts
│   │
│   ├── audio/
│   │   ├── AudioPipeline.ts
│   │   └── FFmpegManager.ts
│   │
│   ├── ui/
│   │   ├── embeds/
│   │   └── buttons/
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── time.ts
│   │
│   └── index.ts
│
├── tests/
│
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── .env.example
├── package.json
├── tsconfig.json
└── README.md

```

---

# 49. PlayerManager

Créer un service central :

```ts
PlayerManager

```

Responsable de :

```text
Guild ID
   ↓
GuildPlayer

```

Méthodes conceptuelles :

```ts
get(guildId)
create(guildId)
getOrCreate(guildId)
destroy(guildId)

```

---

# 50. GuildPlayer

Le GuildPlayer doit être la classe principale responsable de la musique pour un serveur.

Responsabilités :

```text
Voice Connection
AudioPlayer
Current Track
Queue
Playback State
Idle Timer

```

Méthodes potentielles :

```ts
connect()
add()
play()
playNext()
pause()
resume()
skip()
stop()
disconnect()
destroy()

```

---

# 51. Logs

Le bot doit produire des logs structurés.

Exemples :

```text
INFO guild=123 Connected to voice channel
INFO guild=123 track="Get Lucky" Playback started
INFO guild=123 track="Starboy" Added to queue

WARN guild=123 yt-dlp retry

ERROR guild=123 ffmpeg exited unexpectedly

```

Les logs ne doivent jamais contenir :

- Discord Token ;
- secrets ;
- cookies sensibles ;
- identifiants privés inutiles.

---

# 52. Healthcheck

Prévoir au minimum un mécanisme permettant de savoir si le bot fonctionne.

Exemple Docker :

```text
Bot process running
Discord client ready

```

Un serveur HTTP de healthcheck pourra être ajouté :

```text
GET /health

```

Réponse :

```json
{
  "status": "ok"
}

```

Cela reste facultatif pour le MVP.

---

# 53. Docker

Le bot doit pouvoir être lancé avec :

```bash
docker compose up -d

```

L'image doit contenir :

```text
Node.js
Bot
FFmpeg
yt-dlp

```

---

# 54. Docker Compose

Architecture MVP :

```text
docker-compose
      │
      └── discord-music-bot

```

Aucun PostgreSQL ni Redis ne doit être nécessaire.

---

# 55. Redémarrage

Configurer :

```yaml
restart: unless-stopped

```

Le bot doit automatiquement redémarrer après :

- reboot serveur ;
- crash du processus ;
- redémarrage Docker.

---

# 56. Persistance

La queue n'est pas persistante dans le MVP.

Si le conteneur redémarre :

```text
queue → perdue
current track → perdu

```

C'est un comportement accepté.

---

# 57. Performance

Objectifs indicatifs :

### Commandes Discord

Réaction visible rapidement après réception de la commande.

Pour les opérations longues :

```text
deferReply()

```

puis modification de la réponse une fois la recherche terminée.

### Lecture

Le démarrage doit se faire aussi rapidement que raisonnablement possible après résolution de la source.

---

# 58. Ressources

Le bot doit rester léger lorsqu'aucune musique n'est jouée.

FFmpeg ne doit être lancé que lorsqu'une lecture le nécessite.

Les processus terminés doivent être correctement supprimés.

---

# 59. Nettoyage mémoire

Lorsqu'un GuildPlayer devient inutilisé :

```text
disconnect()
↓
destroy connection
↓
kill FFmpeg
↓
clear timers
↓
clear queue
↓
remove Map entry

```

Il ne doit rester aucun timer ou processus zombie.

---

# 60. Tests unitaires

Tester au minimum :

### QueueManager

- ajouter ;
- retirer ;
- ordre FIFO ;
- vider ;
- taille maximum.

### PlayerManager

- création ;
- récupération ;
- suppression ;
- séparation entre guildes.

### URL Resolver

- URL valide ;
- URL invalide ;
- recherche texte.

### Command Validators

- utilisateur sans vocal ;
- mauvais vocal ;
- queue vide.

---

# 61. Tests d'intégration

Tester :

```text
Command
↓
Provider
↓
Queue
↓
Player

```

Les appels yt-dlp peuvent être mockés lorsque nécessaire.

---

# 62. Tests manuels Discord

Scénario principal :

### Étape 1

Utilisateur A rejoint :

```text
#Music

```

### Étape 2

Utilisateur B rejoint :

```text
#Music

```

### Étape 3

Utilisateur A :

```text
/play Daft Punk Get Lucky

```

### Résultat

Le bot rejoint le vocal.

La musique démarre.

Les deux utilisateurs l'entendent.

---

# 63. Test de queue

Pendant la lecture :

```text
/play Starboy
/play Instant Crush

```

Résultat :

```text
Current
Get Lucky

Queue
1. Starboy
2. Instant Crush

```

---

# 64. Test skip

Commande :

```text
/skip

```

Résultat attendu :

```text
Get Lucky stopped

Starboy started

```

---

# 65. Test pause

```text
/pause

```

La musique s'arrête temporairement.

Puis :

```text
/resume

```

La lecture reprend.

---

# 66. Test de fin de queue

Lorsque le dernier morceau se termine :

```text
Queue Empty
↓
Idle timer
↓
Auto disconnect

```

---

# 67. Critères de validation finale

Le MVP est validé lorsque :

1. le bot se connecte correctement à Discord ;
2. les slash commands sont disponibles ;
3. `/play` avec une recherche fonctionne ;
4. `/play` avec une URL fonctionne ;
5. le bot rejoint automatiquement le vocal ;
6. tous les utilisateurs du salon entendent l'audio ;
7. plusieurs morceaux peuvent être ajoutés ;
8. la queue respecte l'ordre ;
9. le morceau suivant démarre automatiquement ;
10. `/pause` fonctionne ;
11. `/resume` fonctionne ;
12. `/skip` fonctionne ;
13. `/stop` fonctionne ;
14. `/queue` fonctionne ;
15. `/nowplaying` fonctionne ;
16. `/leave` fonctionne ;
17. une erreur de morceau ne crash pas le bot ;
18. le bot peut fonctionner sur plusieurs serveurs simultanément ;
19. les queues restent indépendantes ;
20. le bot fonctionne dans Docker.

---

# 68. Definition of Done du MVP

Le développement du MVP est terminé uniquement lorsque ce scénario complet fonctionne :

```text
Mehdi rejoint Discord
        ↓
Une deuxième personne rejoint
        ↓
/play Get Lucky Daft Punk
        ↓
Bot rejoint
        ↓
Get Lucky démarre
        ↓
/play Starboy
        ↓
Starboy ajouté à la queue
        ↓
/queue
        ↓
Starboy visible
        ↓
/pause
        ↓
Lecture en pause
        ↓
/resume
        ↓
Lecture reprend
        ↓
/skip
        ↓
Starboy démarre
        ↓
/stop
        ↓
Musique arrêtée
        ↓
/leave
        ↓
Bot quitte

```

Le tout doit fonctionner sans intervention dans la console du serveur.

---

# 69. Phase 1 — MVP

Fonctionnalités obligatoires :

```text
/play
/pause
/resume
/skip
/stop
/queue
/nowplaying
/leave

```

Technologies :

```text
Discord.js
@discordjs/voice
yt-dlp
FFmpeg
TypeScript
Docker

```

---

# 70. Phase 1.1 — Amélioration UX

Après validation du MVP :

Ajouter :

```text
Boutons
Volume
Shuffle
Repeat
Previous

```

Interface :

```text
🎵 Get Lucky — Daft Punk

██████████░░░░░░░

02:43 / 06:09

[ ⏮ ] [ ⏸ ] [ ⏭ ]
[ 🔀 ] [ 🔁 ] [ ⏹ ]

```

---

# 71. Phase 1.2 — Playlists YouTube

Support :

```text
/play <playlist>

```

Le bot récupère plusieurs titres puis les ajoute progressivement à la queue.

Limiter le nombre maximum de morceaux importables afin d'éviter les abus.

---

# 72. Phase 1.3 — Spotify

Spotify ne doit pas nécessairement servir directement de source audio.

Approche possible :

```text
Spotify URL
     ↓
Spotify Metadata
     ↓
Title + Artist
     ↓
Search Audio Provider
     ↓
Playback

```

Exemple :

```text
Spotify:
Daft Punk — Get Lucky

↓ Recherche

AudioProvider:
Daft Punk Get Lucky

```

---

# 73. Phase 1.4 — Playlists personnelles

Ajouter :

```text
/playlist create
/playlist delete
/playlist add
/playlist remove
/playlist play
/playlist list

```

Cela nécessitera alors une base de données.

Choix conseillé :

```text
PostgreSQL

```

ou SQLite pour une installation strictement personnelle.

---

# 74. Phase 2 — Lavalink

Si le bot devient utilisé par beaucoup de serveurs :

```text
Discord Bot
      ↓
Lavalink
      ↓
Audio Providers

```

Le bot ne gère alors plus directement toute la chaîne audio.

Avantages recherchés :

- meilleure séparation ;
- architecture distribuable ;
- meilleure scalabilité ;
- plusieurs nodes audio possibles.

Ne pas introduire Lavalink avant que le MVP simple fonctionne correctement.

---
# 75. Phase 3 — Dashboard Web

Créer éventuellement :

```text
Next.js
        ↓
Music Bot API
        ↓
Discord Player

```

Dashboard permettant :

- voir le morceau actuel ;
- contrôler la musique ;
- voir la queue ;
- changer le volume ;
- gérer les playlists ;
- voir les serveurs ;
- configurer le bot.

---

# 76. Phase 4 — Système avancé

Fonctionnalités potentielles :

```text
Autoplay
Recommendations
Lyrics
Favorites
History
User playlists
Collaborative playlists
DJ roles
Vote skip
24/7 mode
Radio
Multiple audio providers

```

---

# 77. Risques techniques

## Changements YouTube

Les mécanismes utilisés par YouTube peuvent changer.

Conséquence :

```text
yt-dlp peut temporairement ne plus fonctionner correctement.

```

Solution :

- isoler YouTube derrière un Provider ;
- garder yt-dlp à jour ;
- ne jamais lier directement le MusicPlayer à YouTube.

---

## Discord Voice

L'API et les bibliothèques Discord peuvent évoluer.

Solution :

- utiliser `@discordjs/voice` ;
- isoler la logique audio ;
- mettre régulièrement à jour les dépendances.

---

## FFmpeg

Un processus FFmpeg peut crash ou rester bloqué.

Prévoir :

- timeout ;
- surveillance du processus ;
- kill lors d'un skip ;
- kill lors d'une déconnexion ;
- nettoyage après erreur.

---

# 78. Respect des plateformes et des contenus

Le projet doit être destiné à diffuser des contenus auxquels les utilisateurs sont autorisés à accéder et qu'ils sont autorisés à utiliser.

Le projet ne doit pas chercher à :

- contourner des DRM ;
- contourner des restrictions d'accès ;
- pirater des comptes ;
- récupérer des contenus nécessitant une authentification contournée ;
- conserver illégalement des copies permanentes.

Le MVP est conçu principalement comme un système de lecture audio en direct.

---

# 79. Principes de développement

Le projet doit respecter les principes suivants :

```text
Simple
Stable
Modular
Typed
Testable
Observable
Dockerized

```

Éviter toute surarchitecture.

Pour le MVP :

```text
1 bot
1 processus
0 database
0 Redis
0 microservice
0 Lavalink

```

Architecture suffisante :

```text
Discord Bot
+
Audio Provider
+
FFmpeg
+
yt-dlp

```

---

# 80. Livrables attendus

Le projet final doit fournir :

- code source TypeScript ;
- configuration Discord ;
- slash commands ;
- MusicPlayer ;
- QueueManager ;
- YouTubeProvider ;
- gestion FFmpeg ;
- Dockerfile ;
- docker-compose.yml ;
- `.env.example` ;
- `.gitignore` ;
- tests ;
- README ;
- instructions d'installation ;
- instructions de création du bot Discord ;
- instructions de déploiement ;
- description des commandes ;
- section dépannage.

---

# 81. README attendu

Le README doit contenir :

```text
Présentation
Features
Screenshots éventuels
Prerequisites
Discord Bot Setup
Installation
Environment Variables
Local Development
Docker Deployment
Commands
Architecture
Troubleshooting
Roadmap
License

```

---

# 82. Priorité absolue

L'agent de développement ne doit pas commencer par :

```text
Spotify
Dashboard
Database
Lavalink
IA
Playlists persistantes

```

avant que cette boucle fonctionne parfaitement :

```text
JOIN
 ↓
SEARCH
 ↓
RESOLVE
 ↓
STREAM
 ↓
PLAY
 ↓
QUEUE
 ↓
NEXT

```

---

# 83. MVP FINAL

La première version réellement exploitable doit être :

```text
User
 │
 │ /play song
 ▼
Discord Bot
 │
 ▼
YouTubeProvider
 │
 ▼
yt-dlp
 │
 ▼
FFmpeg
 │
 ▼
@discordjs/voice
 │
 ▼
Discord Voice Channel
 │
 ├── Mehdi
 ├── Ami(e)
 └── Bot 🎵

```

L'expérience attendue doit être aussi simple que :

```text
1. Rejoindre le vocal.

2. Taper :
   /play Arctic Monkeys Do I Wanna Know

3. Le bot rejoint.

4. La musique démarre.

5. Ajouter :
   /play The Weeknd Starboy

6. La deuxième musique attend dans la queue.

7. Profiter de la musique ensemble.

```

---

# Conclusion

Le MVP doit privilégier la simplicité et la stabilité.

La première architecture ne doit contenir que les composants réellement nécessaires :

```text
Discord
   ↓
discord.js
   ↓
Music Player
   ↓
YouTube Provider
   ↓
yt-dlp
   ↓
FFmpeg
   ↓
@discordjs/voice
   ↓
Voice Channel

```

Cette architecture doit cependant être suffisamment modulaire pour permettre, sans réécriture majeure, l'ajout futur de Spotify comme source de métadonnées, de playlists, d'une base de données, de Lavalink et éventuellement d'un dashboard web.