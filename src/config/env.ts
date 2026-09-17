function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid integer environment variable: ${name}`);
  }
  return value;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  discordToken: required("DISCORD_TOKEN"),
  discordClientId: required("DISCORD_CLIENT_ID"),
  discordGuildId: process.env.DISCORD_GUILD_ID?.trim() || undefined,
  logLevel: process.env.LOG_LEVEL?.trim() || "info",
  idleTimeoutSeconds: intEnv("IDLE_TIMEOUT_SECONDS", 300),
  emptyChannelTimeoutSeconds: intEnv("EMPTY_CHANNEL_TIMEOUT_SECONDS", 60),
  maxQueueSize: intEnv("MAX_QUEUE_SIZE", 100),
  maxTrackDurationMinutes: intEnv("MAX_TRACK_DURATION_MINUTES", 180),
  maxStreamRetries: intEnv("MAX_STREAM_RETRIES", 2),
  ytdlpPath: process.env.YTDLP_PATH?.trim() || "yt-dlp",
  ffmpegPath: process.env.FFMPEG_PATH?.trim() || "ffmpeg",
  externalProcessTimeoutMs: intEnv("EXTERNAL_PROCESS_TIMEOUT_MS", 20_000),
  voiceConnectionTimeoutMs: intEnv("VOICE_CONNECTION_TIMEOUT_MS", 20_000),
} as const;
