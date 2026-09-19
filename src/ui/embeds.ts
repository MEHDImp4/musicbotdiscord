import { EmbedBuilder } from "discord.js";
import { FILTER_LABELS } from "../audio/filters";
import { formatVolume } from "../audio/volume";
import type { GuildPlayer } from "../music/GuildPlayer";
import type { Track } from "../music/Track";
import { formatDuration } from "../utils/time";
import { renderProgressBar } from "./progress";

export const QUEUE_PAGE_SIZE = 10;

/** Discord.js throws on invalid embed URLs, so only forward well-formed links. */
function safeRemoteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function trackEmbed(title: string, track: Track, volumePercent?: number): EmbedBuilder {
  const fields = [
    { name: "Durée", value: formatDuration(track.duration), inline: true },
    { name: "Demandé par", value: track.requestedBy.username, inline: true },
  ];

  if (volumePercent !== undefined) {
    fields.push({ name: "Volume", value: formatVolume(volumePercent), inline: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`**${track.title}**${track.author ? `\n${track.author}` : ""}`)
    .addFields(...fields);

  const url = safeRemoteUrl(track.webpageUrl);
  if (url) embed.setURL(url);
  const thumbnail = safeRemoteUrl(track.thumbnail);
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

export function nowPlayingEmbed(player: GuildPlayer): EmbedBuilder {
  const track = player.currentTrack;
  const embed = new EmbedBuilder();

  if (!track) {
    return embed.setTitle("🎵 Lecture en cours").setDescription("Aucun morceau en cours.");
  }

  const elapsed = player.playbackElapsedMs ?? 0;
  embed
    .setTitle("🎵 Lecture en cours")
    .setDescription(`**${track.title}**${track.author ? `\n${track.author}` : ""}`)
    .addFields(
      { name: "Progression", value: renderProgressBar(elapsed, track.duration) },
      { name: "État", value: player.state, inline: true },
      { name: "Volume", value: formatVolume(player.volume), inline: true },
      { name: "Autoplay", value: player.autoplay ? "Activé" : "Désactivé", inline: true },
      { name: "Filtre", value: FILTER_LABELS[player.filter], inline: true },
      { name: "Demandé par", value: track.requestedBy.username, inline: true },
    );

  const url = safeRemoteUrl(track.webpageUrl);
  if (url) embed.setURL(url);
  const thumbnail = safeRemoteUrl(track.thumbnail);
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

export function queuePageCount(player: GuildPlayer): number {
  return Math.max(1, Math.ceil(player.queue.size / QUEUE_PAGE_SIZE));
}

export function queueEmbed(player: GuildPlayer, page = 0): EmbedBuilder {
  const upcoming = player.queue.snapshot();
  const current = player.currentTrack;
  const totalPages = queuePageCount(player);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));

  const start = safePage * QUEUE_PAGE_SIZE;
  const pageTracks = upcoming.slice(start, start + QUEUE_PAGE_SIZE);

  const lines = pageTracks.map((track, index) =>
    `${start + index + 1}. **${track.title}**${track.author ? ` — ${track.author}` : ""}`,
  );

  return new EmbedBuilder()
    .setTitle("🎶 File d'attente")
    .addFields(
      {
        name: "En cours",
        value: current
          ? `**${current.title}**${current.author ? ` — ${current.author}` : ""}\n${formatDuration(current.duration)}`
          : "Aucun morceau",
      },
      {
        name: `À suivre (${upcoming.length})`,
        value: lines.length ? lines.join("\n") : "La file est vide.",
      },
    )
    .setFooter({ text: `Page ${safePage + 1}/${totalPages}` });
}
