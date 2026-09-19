import { describe, expect, it } from "vitest";
import { buildFilterChain, FADE_SECONDS, FILTER_PRESETS, isFilterPreset } from "../src/audio/filters";

describe("isFilterPreset", () => {
  it("accepts every known preset", () => {
    for (const preset of FILTER_PRESETS) {
      expect(isFilterPreset(preset)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isFilterPreset("metal")).toBe(false);
    expect(isFilterPreset(undefined)).toBe(false);
    expect(isFilterPreset(42)).toBe(false);
  });
});

describe("buildFilterChain", () => {
  it("starts with a fade-in when playing from the top", () => {
    expect(buildFilterChain("off", undefined, 0)).toBe(`afade=t=in:st=0:d=${FADE_SECONDS}`);
  });

  it("includes the selected preset filter", () => {
    const chain = buildFilterChain("bassboost", 100, 0);
    expect(chain).toContain("bass=g=5");
    expect(chain).not.toContain("asetrate");
  });

  it("keeps presets mutually exclusive", () => {
    const chain = buildFilterChain("nightcore", 100, 0);
    expect(chain).toContain("asetrate=48000*1.25");
    expect(chain).not.toContain("bass=g=5");
    expect(chain).not.toContain("apulsator");
  });

  it("adds a fade-out when the duration is known", () => {
    expect(buildFilterChain("off", 100, 0)).toContain("afade=t=out");
  });

  it("drops the fade-in when seeking mid-track", () => {
    const chain = buildFilterChain("treble", 200, 30);
    expect(chain).toBeDefined();
    expect(chain).not.toContain("afade=t=in");
    expect(chain).toContain("afade=t=out");
    expect(chain).toContain("treble=g=5");
  });

  it("returns no chain for a mid-track seek with no filter or duration", () => {
    expect(buildFilterChain("off", undefined, 30)).toBeUndefined();
  });
});
