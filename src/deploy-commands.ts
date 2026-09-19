import { REST, Routes } from "discord.js";
import { commands } from "./commands";
import { env } from "./config/env";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(env.discordToken);
  const body = commands.map((command) => command.data.toJSON());

  if (env.discordGuildId) {
    await rest.put(Routes.applicationGuildCommands(env.discordClientId, env.discordGuildId), { body });
    logger.info({ count: body.length, guild: env.discordGuildId }, "Registered guild commands");
  } else {
    await rest.put(Routes.applicationCommands(env.discordClientId), { body });
    logger.info({ count: body.length }, "Registered global commands");
  }
}

main().catch((error) => {
  logger.error({ err: error }, "Command deployment failed");
  process.exitCode = 1;
});
