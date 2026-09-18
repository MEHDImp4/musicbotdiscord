import { SlashCommandBuilder } from "discord.js";
import { playbackControlsRows } from "../ui/controls";
import { nowPlayingEmbed } from "../ui/embeds";
import type { CommandDefinition } from "./types";

export const nowplaying: CommandDefinition = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Affiche le morceau actuellement joué"),
  usage: "/nowplaying",
  async execute(interaction, { players }) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", ephemeral: true });
      return;
    }

    const player = players.get(interaction.guildId);
    const track = player?.currentTrack;
    if (!player || !track) {
      await interaction.reply("ℹ️ Aucun morceau n'est actuellement joué.");
      return;
    }

    const message = await interaction.reply({
      embeds: [nowPlayingEmbed(player)],
      components: playbackControlsRows(),
      fetchReply: true,
    });

    player.setNowPlayingMessage(message);
  },
};
