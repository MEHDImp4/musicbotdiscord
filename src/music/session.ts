/**
 * A playback session is identified by the pair (guild, voice channel). Discord
 * only lets a bot occupy one voice channel per guild at a time, so at most one
 * session can be active per guild (several guilds can run in parallel).
 */
export function toSessionId(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

export interface SessionDescriptor {
  channelId: string;
  isConnected: boolean;
}

/**
 * Returns the connected session occupying a different voice channel than
 * `channelId`, if any. Pure and exported for testing.
 */
export function findConflictingSession<T extends SessionDescriptor>(
  sessions: readonly T[],
  channelId: string,
): T | undefined {
  return sessions.find((session) => session.isConnected && session.channelId !== channelId);
}

export function splitSessionId(sessionId: string): { guildId: string; channelId: string } | undefined {
  const separator = sessionId.indexOf(":");
  if (separator <= 0 || separator === sessionId.length - 1) return undefined;
  return {
    guildId: sessionId.slice(0, separator),
    channelId: sessionId.slice(separator + 1),
  };
}
