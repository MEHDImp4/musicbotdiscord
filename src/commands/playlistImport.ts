import type { ChatInputCommandInteraction, VoiceBasedChannel } from "discord.js";
import type { PlayerManager } from "../music/PlayerManager";

/** Resolves a playlist URL and enqueues as many tracks as fit. Assumes the interaction is deferred. */
export async function importPlaylist(
  interaction: ChatInputCommandInteraction,
  players: PlayerManager,
  channel: VoiceBasedChannel,
  url: string,
  limit: number,
): Promise<void> {
  if (!interaction.guildId) return;

  const requestedBy = {
    id: interaction.user.id,
    username: interaction.user.displayName || interaction.user.username,
  };

  try {
    const result = await players.resolvePlaylist(url, requestedBy, limit);
    if (result.tracks.length === 0) {
      await interaction.editReply("❌ Aucun morceau lisible trouvé dans cette playlist.");
      return;
    }

    const player = players.getOrCreate(interaction.guildId, channel.id);
    if (interaction.channelId) player.lastTextChannelId = interaction.channelId;
    await player.connect(channel);

    let added = 0;
    for (const track of result.tracks) {
      try {
        await player.add(track);
        added += 1;
      } catch {
        break;
      }
    }

    const prefix = result.title ? `**${result.title}** — ` : "";
    const capped = result.tracks.length >= limit ? ` (limite : ${limit})` : "";
    await interaction.editReply(`✅ ${prefix}${added} morceau(x) ajouté(s) à la file${capped}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await interaction.editReply(`❌ Impossible d'importer la playlist : ${message}`);
  }
}
