import { SlashCommandBuilder } from "discord.js";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

const LABELS: Record<string, string> = {
  off: "désactivé",
  track: "morceau en boucle",
  queue: "file en boucle",
};

export const loop: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Règle la répétition (désactivé / morceau / file)")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Mode de répétition")
        .setRequired(false)
        .addChoices(
          { name: "Désactivé", value: "off" },
          { name: "Morceau", value: "track" },
          { name: "File", value: "queue" },
        ),
    ),
  usage: "/loop mode:<off|track|queue>",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;

    const mode = interaction.options.getString("mode");
    if (!mode) {
      await interaction.reply(`🔁 Répétition actuelle : **${LABELS[context.player.loopMode]}**`);
      return;
    }

    context.player.loopMode = mode as "off" | "track" | "queue";
    await interaction.reply(`🔁 Répétition réglée sur **${LABELS[mode]}**.`);
  },
};
