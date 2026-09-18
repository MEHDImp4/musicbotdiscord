import type { ButtonInteraction } from "discord.js";
import type { PlayerManager } from "../music/PlayerManager";
import { QUEUE_PAGE_IDS, queueControlsRow } from "../ui/controls";
import { queueEmbed, queuePageCount } from "../ui/embeds";

export async function handleQueuePagination(
  interaction: ButtonInteraction,
  players: PlayerManager,
): Promise<boolean> {
  if (!interaction.customId.startsWith(QUEUE_PAGE_IDS.prefix)) return false;

  if (!interaction.guildId) {
    await interaction.reply({ content: "❌ Ce bouton doit être utilisé dans un serveur.", ephemeral: true });
    return true;
  }

  const player = players.get(interaction.guildId);
  if (!player) {
    await interaction.update({ content: "🎶 La file d'attente est vide.", embeds: [], components: [] });
    return true;
  }

  const requested = Number.parseInt(interaction.customId.slice(QUEUE_PAGE_IDS.prefix.length), 10);
  const totalPages = queuePageCount(player);
  const page = Number.isFinite(requested) ? Math.max(0, Math.min(requested, totalPages - 1)) : 0;

  await interaction.update({
    embeds: [queueEmbed(player, page)],
    components: totalPages > 1 ? [queueControlsRow(page, totalPages)] : [],
  });
  return true;
}
