import { SlashCommandBuilder } from "discord.js";
import { computeSkipThreshold } from "../music/voteSkip";
import { env } from "../config/env";
import { replyTemporary } from "../utils/reply";
import { requireControlChannel } from "./helpers";
import type { CommandDefinition } from "./types";

export const voteskip: CommandDefinition = {
  data: new SlashCommandBuilder().setName("voteskip").setDescription("Vote pour passer au morceau suivant"),
  usage: "/voteskip",
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;

    const humans = context.channel.members.filter((member) => !member.user.bot).size;
    const threshold = computeSkipThreshold(humans, env.voteSkipMin, env.voteSkipRatio);

    const result = await context.player.voteSkip(interaction.user.id, threshold);

    if (result.skipped) {
      await replyTemporary(interaction, "⏭ Assez de votes — morceau ignoré.");
      return;
    }

    await replyTemporary(interaction, `🗳️ Vote enregistré (${result.votes}/${threshold}).`);
  },
};
