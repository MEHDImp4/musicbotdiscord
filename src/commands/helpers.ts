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

/**
 * Resolves the player attached to the caller's voice channel. Commands that
 * mutate playback require the caller to share the bot's channel.
 */
export async function requireControlChannel(
  interaction: ChatInputCommandInteraction,
  players: PlayerManager,
): Promise<ControlContext | null> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", flags: MessageFlags.Ephemeral });
    return null;
  }

  const channel = await memberVoiceChannel(interaction);
  if (!channel) {
    await interaction.reply({ content: "❌ Rejoins d'abord un salon vocal.", flags: MessageFlags.Ephemeral });
    return null;
  }

  const player = players.get(interaction.guildId, channel.id);
  if (!player || !player.isConnected) {
    await interaction.reply({ content: "❌ Le bot n'est pas connecté à ton salon vocal.", flags: MessageFlags.Ephemeral });
    return null;
  }

  if (interaction.channelId) player.lastTextChannelId = interaction.channelId;
  return { player, channel };
}

/**
 * Refuses to open a second voice session in a guild where the bot is already
 * connected elsewhere: Discord allows only one voice channel per guild per bot,
 * so a second join would silently hijack the existing connection. Replies
 * itself (ephemeral) on conflict and returns false.
 */
export async function ensureNoOtherGuildSession(
  interaction: ChatInputCommandInteraction,
  players: PlayerManager,
  channelId: string,
): Promise<boolean> {
  if (!interaction.guildId) return true;

  const conflict = players.findGuildConflict(interaction.guildId, channelId);
  if (!conflict) return true;

  await interaction.reply({
    content: `❌ Je suis déjà connecté dans <#${conflict.channelId}> sur ce serveur. Utilise \`/leave\` là-bas avant de lancer une autre session.`,
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

export type ReadPlayerResult =
  | { status: "ok"; player: GuildPlayer }
  | { status: "notGuild" }
  | { status: "none" };

/**
 * Resolves a player for read-only commands: the caller's channel first, then
 * the only active session of the guild. Never replies itself so callers can
 * send exactly one response.
 */
export async function resolveReadPlayer(
  interaction: ChatInputCommandInteraction,
  players: PlayerManager,
): Promise<ReadPlayerResult> {
  if (!interaction.guildId) return { status: "notGuild" };

  const channel = await memberVoiceChannel(interaction);
  if (channel) {
    const player = players.get(interaction.guildId, channel.id);
    if (player?.isConnected) {
      if (interaction.channelId) player.lastTextChannelId = interaction.channelId;
      return { status: "ok", player };
    }
  }

  const guildPlayers = players.getForGuild(interaction.guildId).filter((player) => player.isConnected);
  if (guildPlayers.length === 1) {
    const player = guildPlayers[0];
    if (interaction.channelId) player.lastTextChannelId = interaction.channelId;
    return { status: "ok", player };
  }

  return { status: "none" };
}

export function canJoinAndSpeak(channel: VoiceBasedChannel, interaction: ChatInputCommandInteraction): boolean {
  const permissions = channel.permissionsFor(interaction.guild!.members.me!);
  return Boolean(
    permissions?.has(PermissionFlagsBits.Connect) && permissions.has(PermissionFlagsBits.Speak),
  );
}
