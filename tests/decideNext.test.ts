import { describe, expect, it } from "vitest";
import { decideNext } from "../src/music/GuildPlayer";
import { QueueManager } from "../src/music/QueueManager";
import type { Track } from "../src/music/Track";

function track(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    webpageUrl: `https://youtube.com/watch?v=${id}`,
    requestedBy: { id: "user", username: "Tester" },
    provider: "youtube",
  };
}

describe("decideNext", () => {
  it("plays the next queued track when loop is off", () => {
    const queue = new QueueManager(5);
    queue.enqueue(track("b"));
    const next = decideNext(track("a"), "off", queue);
    expect(next?.id).toBe("b");
    expect(queue.size).toBe(0);
  });

  it("replays the finished track when loop is track", () => {
    const queue = new QueueManager(5);
    queue.enqueue(track("b"));
    const finished = track("a");
    const next = decideNext(finished, "track", queue);
    expect(next).toBe(finished);
    expect(queue.size).toBe(1);
  });

  it("replays the finished track when loop is track and queue is empty", () => {
    const queue = new QueueManager(5);
    const finished = track("a");
    expect(decideNext(finished, "track", queue)).toBe(finished);
  });

  it("appends the finished track to the end when loop is queue", () => {
    const queue = new QueueManager(5);
    queue.enqueue(track("b"));
    queue.enqueue(track("c"));
    const next = decideNext(track("a"), "queue", queue);
    expect(next?.id).toBe("b");
    expect(queue.snapshot().map((t) => t.id)).toEqual(["c", "a"]);
  });

  it("replays the finished track when loop is queue and nothing else remains", () => {
    const queue = new QueueManager(5);
    const finished = track("a");
    const next = decideNext(finished, "queue", queue);
    expect(next).toBe(finished);
  });

  it("returns undefined when nothing is playing and the queue is empty", () => {
    const queue = new QueueManager(5);
    expect(decideNext(undefined, "off", queue)).toBeUndefined();
  });

  it("does not throw when loop queue re-queue exceeds max size", () => {
    const queue = new QueueManager(1);
    queue.enqueue(track("b"));
    const next = decideNext(track("a"), "queue", queue);
    expect(next?.id).toBe("b");
    expect(queue.size).toBe(1);
  });
});
