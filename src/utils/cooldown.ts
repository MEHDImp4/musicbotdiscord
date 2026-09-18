const timestamps = new Map<string, number>();

/**
 * Returns null if the action is allowed (and records the timestamp),
 * or the number of seconds the caller must still wait.
 */
export function checkCooldown(key: string, windowMs: number): number | null {
  if (windowMs <= 0) return null;

  const now = Date.now();
  const last = timestamps.get(key);

  if (last !== undefined && now - last < windowMs) {
    return Math.ceil((windowMs - (now - last)) / 1000);
  }

  timestamps.set(key, now);

  if (timestamps.size > 5000) {
    for (const [k, t] of timestamps) {
      if (now - t > windowMs) timestamps.delete(k);
    }
  }

  return null;
}

export function clearCooldowns(): void {
  timestamps.clear();
}
