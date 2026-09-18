import { SlashCommandBuilder } from "discord.js";
import type { CommandDefinition } from "./types";

export const help: CommandDefinition = {
  data: new SlashCommandBuilder().setName("help").setDescription("Affiche les commandes du bot"),
  usage: "/help",
  async execute(interaction, { commands }) {
    const lines = commands.map((command) => {
      const usage = command.usage ?? `/${command.data.name}`;
      return `\`${usage}\` — ${command.data.description}`;
    });

    await interaction.reply(["**Commandes disponibles**", ...lines].join("\n"));
  },
};
