import type { TrackProvider } from "../music/Track";
import { YtDlpProvider } from "./YtDlpProvider";

function isSoundCloudUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "soundcloud.com" || host.endsWith(".soundcloud.com");
  } catch {
    return false;
  }
}

export class SoundCloudProvider extends YtDlpProvider {
  readonly name = "soundcloud" as TrackProvider;
  protected readonly searchPrefix = "scsearch";

  protected isAllowedUrl(url: string): boolean {
    return isSoundCloudUrl(url);
  }
}
