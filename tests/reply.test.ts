import { describe, expect, it } from "vitest";
import { shouldAutoDelete } from "../src/utils/reply";

describe("shouldAutoDelete", () => {
  it("deletes transient text messages when enabled", () => {
    expect(shouldAutoDelete(1, 0)).toBe(true);
  });

  it("never deletes messages that carry components", () => {
    expect(shouldAutoDelete(1, 1)).toBe(false);
    expect(shouldAutoDelete(60, 2)).toBe(false);
  });

  it("is disabled when the delay is zero or negative", () => {
    expect(shouldAutoDelete(0, 0)).toBe(false);
    expect(shouldAutoDelete(-5, 0)).toBe(false);
  });
});
