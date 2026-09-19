import { describe, expect, it } from "vitest";
import { formatDuration, parseTimecode } from "../src/utils/time";

describe("parseTimecode", () => {
  it("parses plain seconds", () => {
    expect(parseTimecode("90")).toBe(90);
    expect(parseTimecode("0")).toBe(0);
  });

  it("parses mm:ss and h:mm:ss", () => {
    expect(parseTimecode("1:30")).toBe(90);
    expect(parseTimecode("1:02:03")).toBe(3723);
    expect(parseTimecode(" 2:00 ")).toBe(120);
  });

  it("rejects invalid input", () => {
    expect(parseTimecode("")).toBeUndefined();
    expect(parseTimecode("abc")).toBeUndefined();
    expect(parseTimecode("1:")).toBeUndefined();
    expect(parseTimecode("1:2:3:4")).toBeUndefined();
    expect(parseTimecode("1:-2")).toBeUndefined();
    expect(parseTimecode("1:aa")).toBeUndefined();
  });
});

describe("formatDuration", () => {
  it("formats durations", () => {
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(undefined)).toBe("?");
  });
});
