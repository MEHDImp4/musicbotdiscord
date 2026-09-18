import {
  type ButtonInteraction,
  type GuildMember,
  type VoiceBasedChannel,
} from "discord.js";
import { env } from "../config/env";
import type { PlayerManager } from "../music/PlayerManager";
import { computeSkipThreshold } from "../music/voteSkip";
import { MUSIC_CONTROL_IDS } from "../ui/controls";

const CONTROL_IDS = new Set<string>(Object.values(MUSIC_CONTROL_IDS));

async function replyPrivate(interaction: ButtonInteraction, content: string): Promise<void> {
  await interaction.reply({ content, ephemeral: true });
}

function botVoiceChannel(interaction: ButtonInteraction, channelId: string | undefined): VoiceBasedChannel | null {
  if (!channelId || !interaction.guild) return null;
  const channel = interaction.guild.channels.cache.get(channelId);
  return channel?.isVoiceBased() ? channel : null;
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
      await replyPrivate(interaction, changed ? "⏸ Lecture mise en pause." : "ℹ️ La lecture n'est pas en cours.");
      return true;
    }

    case MUSIC_CONTROL_IDS.resume: {
      const changed = await player.resume();
      await replyPrivate(interaction, changed ? "▶️ Lecture reprise." : "ℹ️ La lecture n'est pas en pause.");
      return true;
    }

    case MUSIC_CONTROL_IDS.skip: {
      const skipped = await player.skip();
      await replyPrivate(interaction, skipped ? "⏭ Morceau ignoré." : "ℹ️ Aucun morceau à ignorer.");
      return true;
    }

    case MUSIC_CONTROL_IDS.stop:
      await player.stop();
      await replyPrivate(interaction, "⏹ Lecture arrêtée et file d'attente vidée.");
      return true;

    case MUSIC_CONTROL_IDS.voteskip: {
      const voiceChannel = botVoiceChannel(interaction, player.channelId);
      const humans = voiceChannel ? voiceChannel.members.filter((m) => !m.user.bot).size : 1;
      const threshold = computeSkipThreshold(humans, env.voteSkipMin, env.voteSkipRatio);
      const result = await player.voteSkip(interaction.user.id, threshold);
      await replyPrivate(
        interaction,
        result.skipped ? "⏭ Assez de votes — morceau ignoré." : `🗳️ Vote enregistré (${result.votes}/${threshold}).`,
      );
      return true;
    }

    case MUSIC_CONTROL_IDS.volumeDown:
    case MUSIC_CONTROL_IDS.volumeUp: {
      const delta = interaction.customId === MUSIC_CONTROL_IDS.volumeUp ? env.volumeStep : -env.volumeStep;
      player.volume = player.volume + delta;
      await replyPrivate(interaction, `🔊 Volume : **${player.volume}%**`);
      return true;
    }

    default:
      return false;
  }
}
