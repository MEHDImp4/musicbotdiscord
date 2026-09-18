import { SlashCommandBuilder } from "discord.js";
import { queueControlsRow } from "../ui/controls";
import { queueEmbed, queuePageCount } from "../ui/embeds";
import type { CommandDefinition } from "./types";

export const queue: CommandDefinition = {
  data: new SlashCommandBuilder().setName("queue").setDescription("Affiche la file d'attente"),
  usage: "/queue",
  async execute(interaction, { players }) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", ephemeral: true });
      return;
    }
    const player = players.get(interaction.guildId);
    if (!player) {
      await interaction.reply("🎶 La file d'attente est vide.");
      return;
    }
    const totalPages = queuePageCount(player);
    await interaction.reply({
      embeds: [queueEmbed(player, 0)],
      components: totalPages > 1 ? [queueControlsRow(0, totalPages)] : [],
    });
  },
};
