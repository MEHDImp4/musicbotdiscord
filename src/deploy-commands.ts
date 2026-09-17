import { REST, Routes } from "discord.js";
import { commands } from "./commands";
import { env } from "./config/env";

async function main(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(env.discordToken);
  const body = commands.map((command) => command.data.toJSON());

  if (env.discordGuildId) {
    await rest.put(Routes.applicationGuildCommands(env.discordClientId, env.discordGuildId), { body });
    console.log(`Registered ${body.length} guild commands in ${env.discordGuildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(env.discordClientId), { body });
    console.log(`Registered ${body.length} global commands.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
