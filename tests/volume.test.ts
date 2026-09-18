import { describe, expect, it } from "vitest";
import { formatVolume, percentToGain, volumeEmoji } from "../src/audio/volume";

describe("percentToGain", () => {
  it("is silent at 0 (and negative)", () => {
    expect(percentToGain(0)).toBe(0);
    expect(percentToGain(-10)).toBe(0);
  });

  it("applies the headroom at 100%", () => {
    // -3 dB
    expect(percentToGain(100)).toBeCloseTo(0.7079, 3);
  });

  it("maps 50% to -18 dB with the default curve", () => {
    expect(20 * Math.log10(percentToGain(50))).toBeCloseTo(-18, 5);
  });

  it("keeps a constant ~3 dB step per 10%", () => {
    const high = 20 * Math.log10(percentToGain(100));
    const next = 20 * Math.log10(percentToGain(90));
    expect(high - next).toBeCloseTo(3, 5);
  });

  it("is strictly monotonic", () => {
    for (let percent = 1; percent <= 100; percent++) {
      expect(percentToGain(percent)).toBeGreaterThan(percentToGain(percent - 1));
    }
  });

  it("clamps values above 100", () => {
    expect(percentToGain(150)).toBeCloseTo(percentToGain(100), 6);
  });

  it("honours custom headroom and range", () => {
    expect(percentToGain(100, 0, 0)).toBeCloseTo(1, 6);
    expect(20 * Math.log10(percentToGain(50, 0, 40))).toBeCloseTo(-20, 5);
  });
});

describe("volumeEmoji", () => {
  it("maps the level ranges", () => {
    expect(volumeEmoji(0)).toBe("🔇");
    expect(volumeEmoji(20)).toBe("🔈");
    expect(volumeEmoji(50)).toBe("🔉");
    expect(volumeEmoji(100)).toBe("🔊");
  });
});

describe("formatVolume", () => {
  it("renders emoji and rounded percent", () => {
    expect(formatVolume(40)).toBe("🔉 40%");
    expect(formatVolume(0)).toBe("🔇 0%");
    expect(formatVolume(120)).toBe("🔊 100%");
  });
});
