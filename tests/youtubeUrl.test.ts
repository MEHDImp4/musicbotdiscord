import { describe, expect, it } from "vitest";
import {
  extractVideoId,
  hasPlaylistParam,
  isPlaylistUrl,
  isYouTubeUrl,
  mixUrl,
  watchUrl,
} from "../src/providers/youtube";

describe("isYouTubeUrl", () => {
  it("accepts YouTube hosts", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/abc")).toBe(true);
    expect(isYouTubeUrl("https://music.youtube.com/watch?v=abc")).toBe(true);
  });

  it("rejects other hosts and invalid input", () => {
    expect(isYouTubeUrl("https://soundcloud.com/artist/track")).toBe(false);
    expect(isYouTubeUrl("https://notyoutube.com/watch?v=abc")).toBe(false);
    expect(isYouTubeUrl("not a url")).toBe(false);
  });
});

describe("extractVideoId", () => {
  it("reads the v parameter", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
  });

  it("reads the short youtu.be path", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube or missing id", () => {
    expect(extractVideoId("https://example.com/watch?v=abc")).toBeNull();
    expect(extractVideoId("https://www.youtube.com/feed/subscriptions")).toBeNull();
  });
});

describe("hasPlaylistParam", () => {
  it("detects a list parameter", () => {
    expect(hasPlaylistParam("https://www.youtube.com/watch?v=abc&list=PL123")).toBe(true);
    expect(hasPlaylistParam("https://www.youtube.com/playlist?list=PL123")).toBe(true);
  });

  it("returns false without a list parameter", () => {
    expect(hasPlaylistParam("https://www.youtube.com/watch?v=abc")).toBe(false);
    expect(hasPlaylistParam("https://youtu.be/abc")).toBe(false);
  });
});

describe("url builders", () => {
  it("builds watch and mix urls", () => {
    expect(watchUrl("abc")).toBe("https://www.youtube.com/watch?v=abc");
    expect(mixUrl("abc")).toBe("https://www.youtube.com/watch?v=abc&list=RDabc");
  });
});

describe("isPlaylistUrl", () => {
  it("detects playlist-only links", () => {
    expect(isPlaylistUrl("https://www.youtube.com/playlist?list=PL123")).toBe(true);
    expect(isPlaylistUrl("https://www.youtube.com/watch?list=PL123")).toBe(true);
  });

  it("treats a video inside a playlist as a single video", () => {
    expect(isPlaylistUrl("https://www.youtube.com/watch?v=abc&list=PL123")).toBe(false);
    expect(isPlaylistUrl("https://youtu.be/abc?list=PL123")).toBe(false);
    expect(isPlaylistUrl("https://www.youtube.com/watch?v=abc")).toBe(false);
  });
});
