import { describe, expect, it } from "vitest";
import { renderProgressBar } from "../src/ui/progress";

describe("renderProgressBar", () => {
  it("shows elapsed only when duration is unknown", () => {
    expect(renderProgressBar(65_000, undefined)).toBe("▶ 1:05");
  });

  it("renders a full bar at the end", () => {
    const bar = renderProgressBar(100_000, 100);
    expect(bar).toContain("🔘");
    expect(bar).not.toContain("🔘▬");
  });

  it("renders an empty bar at the start", () => {
    const bar = renderProgressBar(0, 100);
    expect(bar.startsWith("🔘")).toBe(true);
  });

  it("includes elapsed and total durations", () => {
    const bar = renderProgressBar(30_000, 60);
    expect(bar).toContain("0:30 / 1:00");
  });

  it("clamps progress beyond the total", () => {
    expect(() => renderProgressBar(200_000, 60)).not.toThrow();
  });

  it("treats non-positive duration as unknown", () => {
    expect(renderProgressBar(5_000, 0)).toBe("▶ 0:05");
  });
});
