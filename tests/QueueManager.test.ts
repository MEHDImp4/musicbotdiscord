import { describe, expect, it } from "vitest";
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

describe("QueueManager", () => {
  it("keeps FIFO order", () => {
    const queue = new QueueManager(3);
    queue.enqueue(track("a"));
    queue.enqueue(track("b"));
    expect(queue.dequeue()?.id).toBe("a");
    expect(queue.dequeue()?.id).toBe("b");
  });

  it("clears the queue", () => {
    const queue = new QueueManager(3);
    queue.enqueue(track("a"));
    queue.clear();
    expect(queue.size).toBe(0);
    expect(queue.isEmpty).toBe(true);
  });

  it("enforces maximum size", () => {
    const queue = new QueueManager(1);
    queue.enqueue(track("a"));
    expect(() => queue.enqueue(track("b"))).toThrow(/Queue limit reached/);
  });

  it("enqueueFront puts the track first", () => {
    const queue = new QueueManager(5);
    queue.enqueue(track("a"));
    queue.enqueueFront(track("b"));
    expect(queue.snapshot().map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("enqueueFront enforces maximum size", () => {
    const queue = new QueueManager(1);
    queue.enqueue(track("a"));
    expect(() => queue.enqueueFront(track("b"))).toThrow(/Queue limit reached/);
  });

  it("removeAt removes and returns the track at index", () => {
    const queue = new QueueManager(5);
    queue.enqueue(track("a"));
    queue.enqueue(track("b"));
    queue.enqueue(track("c"));
    expect(queue.removeAt(1)?.id).toBe("b");
    expect(queue.snapshot().map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("removeAt returns undefined for invalid index", () => {
    const queue = new QueueManager(5);
    queue.enqueue(track("a"));
    expect(queue.removeAt(-1)).toBeUndefined();
    expect(queue.removeAt(5)).toBeUndefined();
    expect(queue.removeAt(1.5)).toBeUndefined();
  });

  it("shuffle preserves elements and size", () => {
    const queue = new QueueManager(100);
    const ids = Array.from({ length: 50 }, (_, i) => `t${i}`);
    for (const id of ids) queue.enqueue(track(id));
    queue.shuffle();
    const shuffled = queue.snapshot().map((t) => t.id);
    expect(shuffled).toHaveLength(ids.length);
    expect(new Set(shuffled)).toEqual(new Set(ids));
  });
});
