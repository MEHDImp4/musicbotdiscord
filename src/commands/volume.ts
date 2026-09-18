import { SlashCommandBuilder } from "discord.js";
import { replyTemporary } from "../utils/reply";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const volume: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Règle le volume du bot (0-100)")
    .addIntegerOption((option) =>
      option
        .setName("level")
        .setDescription("Volume en pourcentage (0-100)")
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(false),
    ),
  usage: "/volume level:<0-100>",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;

    const level = interaction.options.getInteger("level");
    if (level === null) {
      await replyTemporary(interaction, `🔊 Volume actuel : **${context.player.volume}%**`);
      return;
    }

    context.player.volume = level;
    await replyTemporary(interaction, `🔊 Volume réglé sur **${context.player.volume}%**`);
  },
};
