export interface Throttle {
  /** Records the key and returns false while it is still within the interval. */
  allow(key: string, now?: number): boolean;
  reset(): void;
}

/**
 * Minimal per-key throttle used to bound outbound work (e.g. autocomplete
 * lookups) without blocking unrelated keys. Pure over `Date.now()` and
 * therefore testable.
 */
export function createThrottle(intervalMs: number, maxEntries = 10_000): Throttle {
  const lastAt = new Map<string, number>();

  return {
    allow(key, now = Date.now()) {
      if (intervalMs <= 0) return true;

      const previous = lastAt.get(key);
      if (previous !== undefined && now - previous < intervalMs) return false;

      lastAt.set(key, now);

      if (lastAt.size > maxEntries) {
        for (const [entryKey, at] of lastAt) {
          if (now - at >= intervalMs) lastAt.delete(entryKey);
        }
      }

      return true;
    },
    reset() {
      lastAt.clear();
    },
  };
}
