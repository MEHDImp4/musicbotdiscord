import { describe, expect, it } from "vitest";
import { createThrottle } from "../src/utils/throttle";

describe("createThrottle", () => {
  it("allows the first call and blocks a repeat within the interval", () => {
    const throttle = createThrottle(300);
    expect(throttle.allow("user-1", 1_000)).toBe(true);
    expect(throttle.allow("user-1", 1_200)).toBe(false);
  });

  it("allows a call once the interval has elapsed", () => {
    const throttle = createThrottle(300);
    expect(throttle.allow("user-1", 1_000)).toBe(true);
    expect(throttle.allow("user-1", 1_300)).toBe(true);
  });

  it("throttles each key independently", () => {
    const throttle = createThrottle(300);
    expect(throttle.allow("user-1", 1_000)).toBe(true);
    expect(throttle.allow("user-2", 1_000)).toBe(true);
    expect(throttle.allow("user-2", 1_100)).toBe(false);
  });

  it("treats a non-positive interval as disabled", () => {
    const throttle = createThrottle(0);
    expect(throttle.allow("user-1", 1_000)).toBe(true);
    expect(throttle.allow("user-1", 1_000)).toBe(true);
  });

  it("clears all state on reset", () => {
    const throttle = createThrottle(300);
    expect(throttle.allow("user-1", 1_000)).toBe(true);
    throttle.reset();
    expect(throttle.allow("user-1", 1_000)).toBe(true);
  });
});
