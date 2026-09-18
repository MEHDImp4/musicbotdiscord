import { SlashCommandBuilder } from "discord.js";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const clear: CommandDefinition = {
  data: new SlashCommandBuilder().setName("clear").setDescription("Vide la file d'attente"),
  usage: "/clear",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;

    const count = context.player.queue.size;
    context.player.queue.clear();
    await interaction.reply(count > 0 ? `🗑️ File vidée (${count} morceaux retirés).` : "ℹ️ La file était déjà vide.");
  },
};
