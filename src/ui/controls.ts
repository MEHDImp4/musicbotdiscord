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
  voteskip: "music:voteskip",
  volumeDown: "music:voldown",
  volumeUp: "music:volup",
} as const;

export const QUEUE_PAGE_IDS = {
  prefix: "queue:page:",
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

export function audioControlsRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.voteskip)
      .setEmoji("🗳️")
      .setLabel("Vote skip")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.volumeDown)
      .setEmoji("🔉")
      .setLabel("-10")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.volumeUp)
      .setEmoji("🔊")
      .setLabel("+10")
      .setStyle(ButtonStyle.Secondary),
  );
}

export function playbackControlsRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [musicControlsRow(), audioControlsRow()];
}

export function queueControlsRow(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  const lastPage = Math.max(0, totalPages - 1);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${QUEUE_PAGE_IDS.prefix}${Math.max(0, page - 1)}`)
      .setEmoji("◀️")
      .setLabel("Précédent")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${QUEUE_PAGE_IDS.prefix}${Math.min(lastPage, page + 1)}`)
      .setEmoji("▶️")
      .setLabel("Suivant")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= lastPage),
  );
}
