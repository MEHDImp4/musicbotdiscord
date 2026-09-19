const YOUTUBE_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
];

export function parseYouTubeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return YOUTUBE_HOSTS.includes(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

export function isYouTubeUrl(value: string): boolean {
  return parseYouTubeUrl(value) !== null;
}

export function extractVideoId(value: string): string | null {
  const url = parseYouTubeUrl(value);
  if (!url) return null;

  if (url.hostname.toLowerCase() === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id || null;
  }

  return url.searchParams.get("v");
}

export function hasPlaylistParam(value: string): boolean {
  const url = parseYouTubeUrl(value);
  return Boolean(url?.searchParams.get("list"));
}

/**
 * True only for links that designate a playlist rather than a single video:
 * a `list` parameter without a `v` parameter (e.g. `/playlist?list=…`).
 */
export function isPlaylistUrl(value: string): boolean {
  const url = parseYouTubeUrl(value);
  if (!url) return false;
  if (url.hostname.toLowerCase() === "youtu.be") return false;
  if (!url.searchParams.get("list")) return false;
  return url.searchParams.get("v") === null;
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function mixUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
}
