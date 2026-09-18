import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { playbackControlsRows } from "../ui/controls";
import { trackEmbed } from "../ui/embeds";
import { canJoinAndSpeak, memberVoiceChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const play: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Recherche ou ajoute une musique YouTube")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Titre, recherche ou URL YouTube")
        .setAutocomplete(true)
        .setRequired(true),
    ),
  cooldownSeconds: 5,
  usage: "/play query:<texte ou URL>",
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

    const existing = players.get(interaction.guildId);
    if (existing?.isConnected && existing.channelId !== channel.id) {
      await interaction.reply({ content: "❌ Tu dois être dans le même salon vocal que le bot.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!canJoinAndSpeak(channel, interaction)) {
      await interaction.reply({ content: "❌ Je n'ai pas la permission de rejoindre ou parler dans ce salon.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();
    const query = interaction.options.getString("query", true);

    try {
      const track = await players.resolveTrack(query, {
        id: interaction.user.id,
        username: interaction.user.displayName || interaction.user.username,
      });

      const player = players.getOrCreate(interaction.guildId);
      if (interaction.channelId) player.lastTextChannelId = interaction.channelId;
      await player.connect(channel);
      const result = await player.add(track);

      if (result.started) {
        await interaction.editReply({
          embeds: [trackEmbed("🎵 Lecture en cours", track)],
          components: playbackControlsRows(),
        });
      } else {
        await interaction.editReply({
          content: `✅ Ajouté à la file d'attente — position #${result.position}`,
          embeds: [trackEmbed("🎵 Ajouté", track)],
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      await interaction.editReply(`❌ Impossible de lire ce morceau : ${message}`);
    }
  },
};
