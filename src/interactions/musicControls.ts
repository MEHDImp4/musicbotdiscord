import {
  type ButtonInteraction,
  type GuildMember,
} from "discord.js";
import type { PlayerManager } from "../music/PlayerManager";
import { MUSIC_CONTROL_IDS } from "../ui/controls";

const CONTROL_IDS = new Set<string>(Object.values(MUSIC_CONTROL_IDS));

async function replyPrivate(interaction: ButtonInteraction, content: string): Promise<void> {
  await interaction.reply({ content, ephemeral: true });
}

export async function handleMusicControl(
  interaction: ButtonInteraction,
  players: PlayerManager,
): Promise<boolean> {
  if (!CONTROL_IDS.has(interaction.customId)) return false;

  if (!interaction.guildId || !interaction.guild) {
    await replyPrivate(interaction, "❌ Ce bouton doit être utilisé dans un serveur.");
    return true;
  }

  const player = players.get(interaction.guildId);
  if (!player || !player.isConnected) {
    await replyPrivate(interaction, "❌ Le bot n'est plus connecté à un salon vocal.");
    return true;
  }

  const member = (await interaction.guild.members.fetch(interaction.user.id)) as GuildMember;
  const channel = member.voice.channel;

  if (!channel) {
    await replyPrivate(interaction, "❌ Rejoins d'abord le salon vocal du bot.");
    return true;
  }

  if (player.channelId !== channel.id) {
    await replyPrivate(interaction, "❌ Tu dois être dans le même salon vocal que le bot.");
    return true;
  }

  switch (interaction.customId) {
    case MUSIC_CONTROL_IDS.pause: {
      const changed = await player.pause();
      await replyPrivate(
        interaction,
        changed ? "⏸ Lecture mise en pause." : "ℹ️ La lecture n'est pas en cours.",
      );
      return true;
    }

    case MUSIC_CONTROL_IDS.resume: {
      const changed = await player.resume();
      await replyPrivate(
        interaction,
        changed ? "▶️ Lecture reprise." : "ℹ️ La lecture n'est pas en pause.",
      );
      return true;
    }

    case MUSIC_CONTROL_IDS.skip: {
      const skipped = await player.skip();
      await replyPrivate(
        interaction,
        skipped ? "⏭ Morceau ignoré." : "ℹ️ Aucun morceau à ignorer.",
      );
      return true;
    }

    case MUSIC_CONTROL_IDS.stop:
      await player.stop();
      await replyPrivate(interaction, "⏹ Lecture arrêtée et file d'attente vidée.");
      return true;

    default:
      return false;
  }
}
