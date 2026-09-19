import { SlashCommandBuilder } from "discord.js";
import { refreshNowPlaying } from "../services/nowPlaying";
import { replyTemporary } from "../utils/reply";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const previous: CommandDefinition = {
  data: new SlashCommandBuilder().setName("previous").setDescription("Rejoue le morceau précédent"),
  usage: "/previous",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;

    const track = await context.player.previous();
    if (!track) {
      await replyTemporary(interaction, "ℹ️ Aucun morceau précédent dans l'historique.");
      return;
    }

    await refreshNowPlaying(context.player);
    await replyTemporary(interaction, `⏮ **${track.title}** rejoué.`);
  },
};
