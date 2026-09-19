import { SlashCommandBuilder } from "discord.js";
import type { CommandDefinition } from "./types";

const MAX_CONTENT = 2_000;

export const help: CommandDefinition = {
  data: new SlashCommandBuilder().setName("help").setDescription("Affiche les commandes du bot"),
  usage: "/help",
  async execute(interaction, { commands }) {
    const lines = commands.map((command) => {
      const usage = command.usage ?? `/${command.data.name}`;
      return `\`${usage}\` — ${command.data.description}`;
    });

    let content = ["**Commandes disponibles**", ...lines].join("\n");
    if (content.length > MAX_CONTENT) {
      content = `${content.slice(0, MAX_CONTENT - 1)}…`;
    }

    await interaction.reply({ content, allowedMentions: { parse: [] } });
  },
};
