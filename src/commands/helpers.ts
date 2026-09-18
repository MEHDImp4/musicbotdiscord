import {
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
  type VoiceBasedChannel,
} from "discord.js";
import type { GuildPlayer } from "../music/GuildPlayer";
import type { PlayerManager } from "../music/PlayerManager";

export async function memberVoiceChannel(
  interaction: ChatInputCommandInteraction,
): Promise<VoiceBasedChannel | null> {
  if (!interaction.guild) return null;
  const member = (await interaction.guild.members.fetch(interaction.user.id)) as GuildMember;
  return member.voice.channel;
}

export interface ControlContext {
  player: GuildPlayer;
  channel: VoiceBasedChannel;
}

export async function requireControlChannel(
  interaction: ChatInputCommandInteraction,
  players: PlayerManager,
): Promise<ControlContext | null> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", flags: MessageFlags.Ephemeral });
    return null;
  }

  const player = players.get(interaction.guildId);
  if (!player || !player.isConnected) {
    await interaction.reply({ content: "❌ Le bot n'est pas connecté à un salon vocal.", flags: MessageFlags.Ephemeral });
    return null;
  }

  const channel = await memberVoiceChannel(interaction);
  if (!channel) {
    await interaction.reply({ content: "❌ Rejoins d'abord un salon vocal.", flags: MessageFlags.Ephemeral });
    return null;
  }

  if (player.channelId !== channel.id) {
    await interaction.reply({ content: "❌ Tu dois être dans le même salon vocal que le bot.", flags: MessageFlags.Ephemeral });
    return null;
  }

  return { player, channel };
}

export function canJoinAndSpeak(channel: VoiceBasedChannel, interaction: ChatInputCommandInteraction): boolean {
  const permissions = channel.permissionsFor(interaction.guild!.members.me!);
  return Boolean(
    permissions?.has(PermissionFlagsBits.Connect) && permissions.has(PermissionFlagsBits.Speak),
  );
}
