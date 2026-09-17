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
});
