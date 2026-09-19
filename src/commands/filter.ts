import { SlashCommandBuilder } from "discord.js";
import { FILTER_LABELS, FILTER_PRESETS, isFilterPreset } from "../audio/filters";
import { refreshNowPlaying } from "../services/nowPlaying";
import { replyTemporary } from "../utils/reply";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const filter: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Applique un filtre audio (bassboost, nightcore, 8D…)")
    .addStringOption((option) =>
      option
        .setName("preset")
        .setDescription("Filtre à appliquer (omettre pour afficher le filtre courant)")
        .setRequired(false)
        .addChoices(...FILTER_PRESETS.map((preset) => ({ name: FILTER_LABELS[preset], value: preset }))),
    ),
  cooldownSeconds: 3,
  usage: "/filter preset:<off|bassboost|nightcore|vaporwave|8d|treble|loudnorm>",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;

    const preset = interaction.options.getString("preset");
    if (!preset) {
      await replyTemporary(interaction, `🎛️ Filtre actuel : **${FILTER_LABELS[context.player.filter]}**.`);
      return;
    }

    if (!isFilterPreset(preset)) {
      await replyTemporary(interaction, "❌ Filtre inconnu.");
      return;
    }

    context.player.filter = preset;

    if (context.player.currentTrack) {
      const positionSeconds = Math.floor((context.player.playbackElapsedMs ?? 0) / 1000);
      await context.player.seek(positionSeconds);
    }

    await refreshNowPlaying(context.player);
    await replyTemporary(interaction, `🎛️ Filtre appliqué : **${FILTER_LABELS[preset]}**.`);
  },
};
