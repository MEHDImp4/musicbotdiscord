import { describe, expect, it } from "vitest";
import { findActiveLineIndex, parseLrc } from "../src/services/lrc";

describe("parseLrc", () => {
  it("parses timestamps and sorts them", () => {
    const lines = parseLrc("[00:12.50] Hello\n[00:10.00] World");
    expect(lines).toEqual([
      { timeMs: 10_000, text: "World" },
      { timeMs: 12_500, text: "Hello" },
    ]);
  });

  it("handles multiple tags on one line", () => {
    const lines = parseLrc("[00:01.00][00:05.00] Chorus");
    expect(lines.map((line) => line.timeMs)).toEqual([1_000, 5_000]);
    expect(lines.every((line) => line.text === "Chorus")).toBe(true);
  });

  it("ignores metadata and empty lines", () => {
    expect(parseLrc("[ar: Artist]\n[00:00.00]\nplain text")).toEqual([]);
  });

  it("supports large minute values", () => {
    expect(parseLrc("[100:00.00] x")[0].timeMs).toBe(100 * 60 * 1000);
  });

  it("interprets hundredths and milliseconds", () => {
    expect(parseLrc("[00:00.05] a")[0].timeMs).toBe(50);
    expect(parseLrc("[00:00.123] b")[0].timeMs).toBe(123);
  });
});

describe("findActiveLineIndex", () => {
  const lines = parseLrc("[00:00.00] a\n[00:10.00] b\n[00:20.00] c");

  it("finds the current line", () => {
    expect(findActiveLineIndex(lines, 0)).toBe(0);
    expect(findActiveLineIndex(lines, 15_000)).toBe(1);
    expect(findActiveLineIndex(lines, 25_000)).toBe(2);
  });

  it("returns -1 before the first line", () => {
    expect(findActiveLineIndex(lines, -1)).toBe(-1);
    expect(findActiveLineIndex([], 1_000)).toBe(-1);
  });
});
