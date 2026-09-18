import { describe, expect, it } from "vitest";
import { parseSuggestions } from "../src/services/suggestions";

describe("parseSuggestions", () => {
  it("extracts the suggestion list from a Google payload", () => {
    const payload = ["query", ["one", "two", "three"], {}];
    expect(parseSuggestions(payload, 10)).toEqual([
      { name: "one", value: "one" },
      { name: "two", value: "two" },
      { name: "three", value: "three" },
    ]);
  });

  it("respects the limit", () => {
    const payload = ["q", ["a", "b", "c", "d"]];
    expect(parseSuggestions(payload, 2)).toHaveLength(2);
  });

  it("deduplicates and trims values", () => {
    const payload = ["q", ["  a  ", "a", "b"]];
    expect(parseSuggestions(payload, 10)).toEqual([
      { name: "a", value: "a" },
      { name: "b", value: "b" },
    ]);
  });

  it("ignores non-string entries", () => {
    const payload = ["q", ["a", 42, null, "b"]];
    expect(parseSuggestions(payload, 10).map((s) => s.value)).toEqual(["a", "b"]);
  });

  it("returns an empty array for malformed payloads", () => {
    expect(parseSuggestions(undefined, 10)).toEqual([]);
    expect(parseSuggestions("nope", 10)).toEqual([]);
    expect(parseSuggestions(["q"], 10)).toEqual([]);
  });
});
