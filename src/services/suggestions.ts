import { logger } from "../utils/logger";

export interface Suggestion {
  name: string;
  value: string;
}

const MAX_CHOICE_LENGTH = 100;

export function parseSuggestions(payload: unknown, limit: number): Suggestion[] {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return [];

  const items = payload[1] as unknown[];
  const seen = new Set<string>();
  const result: Suggestion[] = [];

  for (const item of items) {
    if (typeof item !== "string") continue;
    const value = item.trim().slice(0, MAX_CHOICE_LENGTH);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push({ name: value, value });
    if (result.length >= limit) break;
  }

  return result;
}

export interface SuggestionsProvider {
  suggest(query: string, limit?: number): Promise<Suggestion[]>;
}

export class YouTubeSuggestions implements SuggestionsProvider {
  constructor(private readonly timeoutMs = 800) {}

  async suggest(query: string, limit = 10): Promise<Suggestion[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(trimmed)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as unknown;
      return parseSuggestions(payload, limit);
    } catch (error) {
      logger.debug({ err: error, query: trimmed }, "Suggestion lookup failed");
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
