import { SlashCommandBuilder } from "discord.js";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const shuffle: CommandDefinition = {
  data: new SlashCommandBuilder().setName("shuffle").setDescription("Mélange la file d'attente"),
  usage: "/shuffle",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;

    const count = context.player.queue.size;
    if (count < 2) {
      await interaction.reply("ℹ️ Pas assez de morceaux pour mélanger.");
      return;
    }

    context.player.queue.shuffle();
    await interaction.reply(`🔀 File mélangée (${count} morceaux).`);
  },
};
