import { SlashCommandBuilder } from "discord.js";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const skip: CommandDefinition = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Passe au morceau suivant"),
  usage: "/skip",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;
    const skipped = await context.player.skip();
    await interaction.reply(skipped ? "⏭ Morceau ignoré." : "ℹ️ Aucun morceau à ignorer.");
  },
};
