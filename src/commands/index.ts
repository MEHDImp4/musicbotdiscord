import { clear } from "./clear";
import { help } from "./help";
import { leave } from "./leave";
import { loop } from "./loop";
import { nowplaying } from "./nowplaying";
import { pause } from "./pause";
import { play } from "./play";
import { playnext } from "./playnext";
import { queue } from "./queue";
import { remove } from "./remove";
import { resume } from "./resume";
import { shuffle } from "./shuffle";
import { skip } from "./skip";
import { stop } from "./stop";
import { testaudio } from "./testaudio";
import { volume } from "./volume";
import { voteskip } from "./voteskip";
import type { CommandDefinition } from "./types";

export type { CommandContext, CommandDefinition } from "./types";

export const commands: CommandDefinition[] = [
  play,
  playnext,
  testaudio,
  pause,
  resume,
  skip,
  stop,
  queue,
  nowplaying,
  loop,
  shuffle,
  remove,
  clear,
  voteskip,
  volume,
  leave,
  help,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
