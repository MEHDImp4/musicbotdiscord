import { SlashCommandBuilder } from "discord.js";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const stop: CommandDefinition = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Arrête la musique et vide la queue"),
  usage: "/stop",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;
    await context.player.stop();
    await interaction.reply("⏹ Lecture arrêtée et file d'attente vidée.");
  },
};
