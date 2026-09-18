import { SlashCommandBuilder } from "discord.js";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const remove: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Retire un morceau de la file d'attente")
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription("Position dans la file (1 = premier)")
        .setMinValue(1)
        .setRequired(true),
    ),
  usage: "/remove position:<n>",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;

    const position = interaction.options.getInteger("position", true);
    const size = context.player.queue.size;

    if (size === 0) {
      await interaction.reply("ℹ️ La file d'attente est vide.");
      return;
    }

    const removed = context.player.queue.removeAt(position - 1);
    if (!removed) {
      await interaction.reply(`❌ Position invalide (1 à ${size}).`);
      return;
    }

    await interaction.reply(`🗑️ **${removed.title}** retiré de la file.`);
  },
};
