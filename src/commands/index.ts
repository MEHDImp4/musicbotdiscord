import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type VoiceBasedChannel,
} from "discord.js";
import type { PlayerManager } from "../music/PlayerManager";
import { queueEmbed, trackEmbed } from "../ui/embeds";
import { musicControlsRow } from "../ui/controls";

export interface CommandContext {
  players: PlayerManager;
}

interface CommandDefinition {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
}

async function memberVoiceChannel(interaction: ChatInputCommandInteraction): Promise<VoiceBasedChannel | null> {
  if (!interaction.guild) return null;
  const member = (await interaction.guild.members.fetch(interaction.user.id)) as GuildMember;
  return member.voice.channel;
}

async function requireControlChannel(
  interaction: ChatInputCommandInteraction,
  players: PlayerManager,
): Promise<{ player: NonNullable<ReturnType<PlayerManager["get"]>>; channel: VoiceBasedChannel } | null> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", ephemeral: true });
    return null;
  }

  const player = players.get(interaction.guildId);
  if (!player || !player.isConnected) {
    await interaction.reply({ content: "❌ Le bot n'est pas connecté à un salon vocal.", ephemeral: true });
    return null;
  }

  const channel = await memberVoiceChannel(interaction);
  if (!channel) {
    await interaction.reply({ content: "❌ Rejoins d'abord un salon vocal.", ephemeral: true });
    return null;
  }

  if (player.channelId !== channel.id) {
    await interaction.reply({ content: "❌ Tu dois être dans le même salon vocal que le bot.", ephemeral: true });
    return null;
  }

  return { player, channel };
}

const play: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Recherche ou ajoute une musique YouTube")
    .addStringOption((option) =>
      option.setName("query").setDescription("Titre, recherche ou URL YouTube").setRequired(true),
    ),
  async execute(interaction, { players }) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", ephemeral: true });
      return;
    }

    const channel = await memberVoiceChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: "❌ Tu dois être dans un salon vocal pour utiliser cette commande.", ephemeral: true });
      return;
    }

    const existing = players.get(interaction.guildId);
    if (existing?.isConnected && existing.channelId !== channel.id) {
      await interaction.reply({ content: "❌ Tu dois être dans le même salon vocal que le bot.", ephemeral: true });
      return;
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me!);
    if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
      await interaction.reply({ content: "❌ Je n'ai pas la permission de rejoindre ou parler dans ce salon.", ephemeral: true });
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
      await player.connect(channel);
      const result = await player.add(track);

      if (result.started) {
        await interaction.editReply({
          embeds: [trackEmbed("🎵 Lecture en cours", track)],
          components: [musicControlsRow()],
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

const testaudio: CommandDefinition = {
  data: new SlashCommandBuilder()
    .setName("testaudio")
    .setDescription("Joue un bip local de 3 secondes pour tester Discord Voice"),
  async execute(interaction, { players }) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", ephemeral: true });
      return;
    }

    const channel = await memberVoiceChannel(interaction);
    if (!channel) {
      await interaction.reply({ content: "❌ Rejoins d'abord un salon vocal.", ephemeral: true });
      return;
    }

    const existing = players.get(interaction.guildId);
    if (existing?.isConnected && existing.channelId !== channel.id) {
      await interaction.reply({ content: "❌ Tu dois être dans le même salon vocal que le bot.", ephemeral: true });
      return;
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me!);
    if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
      await interaction.reply({ content: "❌ Je n'ai pas la permission de rejoindre ou parler dans ce salon.", ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const player = players.getOrCreate(interaction.guildId);
      await player.connect(channel);
      await player.playDiagnosticTone();
      await interaction.editReply("🔊 Test audio lancé : tu dois entendre un bip de 440 Hz pendant 3 secondes.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      await interaction.editReply(`❌ Test audio impossible : ${message}`);
    }
  },
};

const pause: CommandDefinition = {
  data: new SlashCommandBuilder().setName("pause").setDescription("Met la lecture en pause"),
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;
    const changed = await context.player.pause();
    await interaction.reply(changed ? "⏸ Lecture mise en pause." : "ℹ️ La lecture n'est pas en cours.");
  },
};

const resume: CommandDefinition = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Reprend la lecture"),
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;
    const changed = await context.player.resume();
    await interaction.reply(changed ? "▶️ Lecture reprise." : "ℹ️ La lecture n'est pas en pause.");
  },
};

const skip: CommandDefinition = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Passe au morceau suivant"),
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;
    const skipped = await context.player.skip();
    await interaction.reply(skipped ? "⏭ Morceau ignoré." : "ℹ️ Aucun morceau à ignorer.");
  },
};

const stop: CommandDefinition = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Arrête la musique et vide la queue"),
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context) return;
    await context.player.stop();
    await interaction.reply("⏹ Lecture arrêtée et file d'attente vidée.");
  },
};

const queue: CommandDefinition = {
  data: new SlashCommandBuilder().setName("queue").setDescription("Affiche la file d'attente"),
  async execute(interaction, { players }) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "❌ Cette commande doit être utilisée dans un serveur.", ephemeral: true });
      return;
    }
    const player = players.get(interaction.guildId);
    if (!player) {
      await interaction.reply("🎶 La file d'attente est vide.");
      return;
    }
    await interaction.reply({ embeds: [queueEmbed(player)] });
  },
};

const nowplaying: CommandDefinition = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Affiche le morceau actuellement joué"),
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
    const embed = trackEmbed("🎵 Now Playing", track).addFields({ name: "État", value: player.state, inline: true });
    await interaction.reply({ embeds: [embed], components: [musicControlsRow()] });
  },
};

const leave: CommandDefinition = {
  data: new SlashCommandBuilder().setName("leave").setDescription("Arrête tout et quitte le salon vocal"),
  async execute(interaction, { players }) {
    const context = await requireControlChannel(interaction, players);
    if (!context || !interaction.guildId) return;
    await players.destroy(interaction.guildId);
    await interaction.reply("👋 Déconnecté du salon vocal.");
  },
};

const help: CommandDefinition = {
  data: new SlashCommandBuilder().setName("help").setDescription("Affiche les commandes du bot"),
  async execute(interaction) {
    await interaction.reply([
      "**Commandes disponibles**",
      "`/play query:<texte ou URL>` — jouer/ajouter un morceau",
      "`/testaudio` — tester uniquement Discord Voice avec un bip local",
      "`/pause` — pause",
      "`/resume` — reprendre",
      "`/skip` — morceau suivant",
      "`/stop` — arrêter et vider la queue",
      "`/queue` — afficher la queue",
      "`/nowplaying` — morceau actuel",
      "`/leave` — quitter le vocal",
    ].join("\n"));
  },
};

export const commands: CommandDefinition[] = [play, testaudio, pause, resume, skip, stop, queue, nowplaying, leave, help];
export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
