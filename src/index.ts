import { generateDependencyReport } from "@discordjs/voice";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { commandMap } from "./commands";
import { handleMusicControl } from "./interactions/musicControls";
import { env } from "./config/env";
import { PlayerManager } from "./music/PlayerManager";
import { YouTubeProvider } from "./providers/YouTubeProvider";
import { logger } from "./utils/logger";

logger.info(
  { node: process.version, report: generateDependencyReport() },
  "Discord voice dependency report",
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const players = new PlayerManager(new YouTubeProvider());

client.once(Events.ClientReady, (readyClient) => {
  logger.info({ user: readyClient.user.tag, guilds: readyClient.guilds.cache.size }, "Discord client ready");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    try {
      const handled = await handleMusicControl(interaction, players);
      if (handled) return;
    } catch (error) {
      logger.error(
        { err: error, customId: interaction.customId, guild: interaction.guildId },
        "Music control button failed",
      );
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "❌ Impossible d'exécuter cette action.", ephemeral: true }).catch(() => undefined);
      } else {
        await interaction.reply({ content: "❌ Impossible d'exécuter cette action.", ephemeral: true }).catch(() => undefined);
      }
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;
  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, { players });
  } catch (error) {
    logger.error({ err: error, command: interaction.commandName, guild: interaction.guildId }, "Command failed");
    const message = "❌ Une erreur inattendue est survenue.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => undefined);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
    }
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const guild = newState.guild ?? oldState.guild;
  const player = players.get(guild.id);
  if (!player?.channelId) return;

  const channel = guild.channels.cache.get(player.channelId);
  if (!channel?.isVoiceBased()) return;

  const humanCount = channel.members.filter((member) => !member.user.bot).size;
  if (humanCount === 0) player.handleHumansEmpty();
  else player.handleHumansPresent();
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down");
  await players.destroyAll();
  client.destroy();
}

process.once("SIGINT", () => void shutdown("SIGINT").finally(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown("SIGTERM").finally(() => process.exit(0)));

client.login(env.discordToken).catch((error) => {
  logger.fatal({ err: error }, "Unable to login to Discord");
  process.exitCode = 1;
});
