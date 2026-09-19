/**
 * A playback session is identified by the pair (guild, voice channel) so that
 * a single guild can host several independent players at once.
 */
export function toSessionId(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

export function splitSessionId(sessionId: string): { guildId: string; channelId: string } | undefined {
  const separator = sessionId.indexOf(":");
  if (separator <= 0 || separator === sessionId.length - 1) return undefined;
  return {
    guildId: sessionId.slice(0, separator),
    channelId: sessionId.slice(separator + 1),
  };
}
