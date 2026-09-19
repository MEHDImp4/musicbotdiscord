import { SlashCommandBuilder } from "discord.js";
import { refreshNowPlaying } from "../services/nowPlaying";
import { replyTemporary } from "../utils/reply";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const autoplay: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Active ou désactive la lecture automatique de titres similaires")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Activer ou désactiver l'autoplay")
        .setRequired(false)
        .addChoices(
          { name: "Activé", value: "on" },
          { name: "Désactivé", value: "off" },
        ),
    ),
  usage: "/autoplay mode:<on|off>",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;

    const mode = interaction.options.getString("mode");
    if (!mode) {
      await replyTemporary(
        interaction,
        `♾️ Autoplay actuellement **${context.player.autoplay ? "activé" : "désactivé"}**.`,
      );
      return;
    }

    context.player.autoplay = mode === "on";
    await refreshNowPlaying(context.player);
    await replyTemporary(
      interaction,
      `♾️ Autoplay **${context.player.autoplay ? "activé" : "désactivé"}**.`,
    );
  },
};
