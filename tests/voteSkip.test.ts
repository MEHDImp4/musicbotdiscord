import { describe, expect, it } from "vitest";
import { computeSkipThreshold } from "../src/music/voteSkip";

describe("computeSkipThreshold", () => {
  it("applies the minimum when few listeners", () => {
    expect(computeSkipThreshold(1, 2, 0.5)).toBe(2);
    expect(computeSkipThreshold(2, 2, 0.5)).toBe(2);
  });

  it("uses majority of human listeners", () => {
    expect(computeSkipThreshold(10, 2, 0.5)).toBe(5);
    expect(computeSkipThreshold(7, 2, 0.5)).toBe(4);
  });

  it("respects a custom ratio", () => {
    expect(computeSkipThreshold(10, 2, 0.3)).toBe(3);
  });

  it("handles zero listeners", () => {
    expect(computeSkipThreshold(0, 2, 0.5)).toBe(2);
  });
});
