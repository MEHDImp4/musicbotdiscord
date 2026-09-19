import { SlashCommandBuilder } from "discord.js";
import { replyTemporary } from "../utils/reply";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const leave: CommandDefinition = {
  data: new SlashCommandBuilder().setName("leave").setDescription("Arrête tout et quitte le salon vocal"),
  usage: "/leave",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context || !interaction.guildId) return;
    await players.destroy(interaction.guildId, context.channel.id);
    await replyTemporary(interaction, "👋 Déconnecté du salon vocal.");
  },
};
