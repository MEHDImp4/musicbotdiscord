import { EmbedBuilder } from "discord.js";
import type { GuildPlayer } from "../music/GuildPlayer";
import type { Track } from "../music/Track";
import { formatDuration } from "../utils/time";

export function trackEmbed(title: string, track: Track): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`**${track.title}**${track.author ? `\n${track.author}` : ""}`)
    .addFields(
      { name: "Durée", value: formatDuration(track.duration), inline: true },
      { name: "Demandé par", value: track.requestedBy.username, inline: true },
    )
    .setURL(track.webpageUrl);

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  return embed;
}

export function queueEmbed(player: GuildPlayer): EmbedBuilder {
  const upcoming = player.queue.snapshot();
  const current = player.currentTrack;

  const lines = upcoming.slice(0, 10).map((track, index) =>
    `${index + 1}. **${track.title}**${track.author ? ` — ${track.author}` : ""}`,
  );

  if (upcoming.length > 10) lines.push(`… et ${upcoming.length - 10} autre(s)`);

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
    );
}
