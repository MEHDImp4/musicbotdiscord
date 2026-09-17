import type { Track } from "./Track";

export class QueueManager {
  private readonly tracks: Track[] = [];

  constructor(private readonly maxSize: number) {}

  enqueue(track: Track): number {
    if (this.tracks.length >= this.maxSize) {
      throw new Error(`Queue limit reached (${this.maxSize})`);
    }
    this.tracks.push(track);
    return this.tracks.length;
  }

  dequeue(): Track | undefined {
    return this.tracks.shift();
  }

  clear(): void {
    this.tracks.length = 0;
  }

  snapshot(): readonly Track[] {
    return [...this.tracks];
  }

  get size(): number {
    return this.tracks.length;
  }

  get isEmpty(): boolean {
    return this.tracks.length === 0;
  }
}
