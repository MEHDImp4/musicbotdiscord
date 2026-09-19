import { SlashCommandBuilder } from "discord.js";
import { replyTemporary } from "../utils/reply";
import { playbackControlsRows } from "../ui/controls";
import { nowPlayingEmbed } from "../ui/embeds";
import { resolveReadPlayer } from "./helpers";
import type { CommandDefinition } from "./types";

export const nowplaying: CommandDefinition = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Affiche le morceau actuellement joué"),
  usage: "/nowplaying",
  async execute(interaction, { players }) {
    const player = await resolveReadPlayer(interaction, players);
    const track = player?.currentTrack;
    if (!player || !track) {
      await replyTemporary(interaction, "ℹ️ Aucun morceau n'est actuellement joué.");
      return;
    }

    const message = await interaction.reply({
      embeds: [nowPlayingEmbed(player)],
      components: playbackControlsRows(player.channelId),
      fetchReply: true,
    });

    player.setNowPlayingMessage(message);
  },
};
