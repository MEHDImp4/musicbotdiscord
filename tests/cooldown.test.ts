import { afterEach, describe, expect, it, vi } from "vitest";
import { checkCooldown, clearCooldowns } from "../src/utils/cooldown";

describe("checkCooldown", () => {
  afterEach(() => {
    clearCooldowns();
    vi.useRealTimers();
  });

  it("allows the first call", () => {
    expect(checkCooldown("user:play", 5000)).toBeNull();
  });

  it("blocks a second call within the window and reports remaining seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(checkCooldown("user:play", 5000)).toBeNull();
    expect(checkCooldown("user:play", 5000)).toBe(5);
  });

  it("allows a call after the window has elapsed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(checkCooldown("user:play", 5000)).toBeNull();
    vi.setSystemTime(new Date("2026-01-01T00:00:06Z"));
    expect(checkCooldown("user:play", 5000)).toBeNull();
  });

  it("treats a non-positive window as disabled", () => {
    expect(checkCooldown("user:play", 0)).toBeNull();
    expect(checkCooldown("user:play", 0)).toBeNull();
  });

  it("keeps cooldowns independent per key", () => {
    expect(checkCooldown("a:play", 5000)).toBeNull();
    expect(checkCooldown("b:play", 5000)).toBeNull();
  });
});
