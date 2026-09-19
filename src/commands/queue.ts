import { SlashCommandBuilder } from "discord.js";
import { replyTemporary } from "../utils/reply";
import { queueControlsRow } from "../ui/controls";
import { queueEmbed, queuePageCount } from "../ui/embeds";
import { resolveReadPlayer } from "./helpers";
import type { CommandDefinition } from "./types";

export const queue: CommandDefinition = {
  data: new SlashCommandBuilder().setName("queue").setDescription("Affiche la file d'attente"),
  usage: "/queue",
  async execute(interaction, { players }) {
    const player = await resolveReadPlayer(interaction, players);
    if (!player) {
      await replyTemporary(interaction, "🎶 La file d'attente est vide.");
      return;
    }
    const totalPages = queuePageCount(player);
    await interaction.reply({
      embeds: [queueEmbed(player, 0)],
      components: totalPages > 1 ? [queueControlsRow(player.channelId, 0, totalPages)] : [],
    });
  },
};
