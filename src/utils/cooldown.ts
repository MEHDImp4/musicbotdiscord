interface CooldownEntry {
  at: number;
  windowMs: number;
}

const timestamps = new Map<string, CooldownEntry>();

/**
 * Returns null if the action is allowed (and records the timestamp),
 * or the number of seconds the caller must still wait.
 */
export function checkCooldown(key: string, windowMs: number): number | null {
  if (windowMs <= 0) return null;

  const now = Date.now();
  const last = timestamps.get(key);

  if (last !== undefined && now - last.at < windowMs) {
    return Math.ceil((windowMs - (now - last.at)) / 1000);
  }

  timestamps.set(key, { at: now, windowMs });

  if (timestamps.size > 5000) {
    // Evict with each entry's own window so a short-window command cannot
    // prematurely expire a long-window one.
    for (const [k, entry] of timestamps) {
      if (now - entry.at > entry.windowMs) timestamps.delete(k);
    }
  }

  return null;
}

export function clearCooldowns(): void {
  timestamps.clear();
}
