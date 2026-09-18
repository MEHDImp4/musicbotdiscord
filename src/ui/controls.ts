import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export const MUSIC_CONTROL_IDS = {
  pause: "music:pause",
  resume: "music:resume",
  skip: "music:skip",
  stop: "music:stop",
} as const;

export function musicControlsRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.pause)
      .setEmoji("⏸️")
      .setLabel("Pause")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.resume)
      .setEmoji("▶️")
      .setLabel("Reprendre")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.skip)
      .setEmoji("⏭️")
      .setLabel("Suivant")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.stop)
      .setEmoji("⏹️")
      .setLabel("Stop")
      .setStyle(ButtonStyle.Danger),
  );
}
