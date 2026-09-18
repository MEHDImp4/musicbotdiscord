import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { PlayerManager } from "../music/PlayerManager";

export type SlashCommand =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface CommandContext {
  players: PlayerManager;
  commands: CommandDefinition[];
}

export interface CommandDefinition {
  data: SlashCommand;
  cooldownSeconds?: number;
  usage?: string;
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
}
