import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { env } from "../config/env";
import { LyricsService } from "../services/lyrics";
import { replyTemporary } from "../utils/reply";
import { resolveReadPlayer } from "./helpers";
import type { CommandDefinition } from "./types";

const lyricsService = new LyricsService();
const MAX_DESCRIPTION = 3_900;

function truncate(text: string): string {
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1)}…` : text;
}

export const lyrics: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Affiche les paroles du morceau en cours ou d'une recherche")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Titre / artiste (omettre pour le morceau en cours)")
        .setRequired(false),
    ),
  cooldownSeconds: 5,
  usage: "/lyrics [query:<texte>]",
  async execute(interaction, { players }) {
    if (!env.lyricsEnabled) {
      await replyTemporary(interaction, "ℹ️ Les paroles sont désactivées.");
      return;
    }

    const query = interaction.options.getString("query");
    let title = query?.trim();
    let artist: string | undefined;
    let durationSeconds: number | undefined;

    if (!title) {
      const result = await resolveReadPlayer(interaction, players);
      const track = result.status === "ok" ? result.player.currentTrack : undefined;
      if (result.status !== "ok" || !track) {
        await replyTemporary(
          interaction,
          result.status === "notGuild"
            ? "❌ Cette commande doit être utilisée dans un serveur."
            : "ℹ️ Aucun morceau en cours. Précise un titre : `/lyrics query:<…>`.",
        );
        return;
      }
      title = track.title;
      artist = track.author;
      durationSeconds = track.duration;
    }

    await interaction.deferReply();

    const result = await lyricsService.lookup({ title, artist, durationSeconds });
    if (!result) {
      await interaction.editReply(`❌ Paroles introuvables pour **${title}**.`);
      return;
    }

    const body = result.plain ?? result.synced?.map((line) => line.text).join("\n") ?? "";
    const embed = new EmbedBuilder()
      .setTitle(`🎤 ${result.trackName}${result.artistName ? ` — ${result.artistName}` : ""}`)
      .setDescription(truncate(body))
      .setFooter({ text: `Source : ${result.source}${result.synced ? " · paroles synchronisées" : ""}` });

    await interaction.editReply({ embeds: [embed] });
  },
};
