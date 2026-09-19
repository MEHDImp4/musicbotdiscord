import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { env } from "../config/env";
import { canJoinAndSpeak, memberVoiceChannel } from "./helpers";
import { importPlaylist } from "./playlistImport";
import type { CommandDefinition } from "./types";

export const playlist: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("Ajoute une playlist YouTube à la file d'attente")
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("URL de la playlist YouTube")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription(`Nombre maximum de morceaux (max ${env.playlistMaxItems})`)
        .setMinValue(1)
        .setMaxValue(env.playlistMaxItems)
        .setRequired(false),
    ),
  cooldownSeconds: 10,
  usage: "/playlist url:<URL> [limit:<n>]",
  async execute(interaction, { players }) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", flags: MessageFlags.Ephemeral });
      return;
    }

    const channel = await memberVoiceChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: "❌ Tu dois être dans un salon vocal pour utiliser cette commande.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!canJoinAndSpeak(channel, interaction)) {
      await interaction.reply({ content: "❌ Je n'ai pas la permission de rejoindre ou parler dans ce salon.", flags: MessageFlags.Ephemeral });
      return;
    }

    const url = interaction.options.getString("url", true);
    const limit = interaction.options.getInteger("limit") ?? env.playlistMaxItems;

    await interaction.deferReply();
    await importPlaylist(interaction, players, channel, url, limit);
  },
};
