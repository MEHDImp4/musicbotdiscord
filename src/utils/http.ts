export interface FetchJsonOptions {
  timeoutMs?: number;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxBytes?: number;
  redirect?: RequestRedirect;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 1_000_000;

/** Bounded text fetch with a hard timeout; refuses redirects and oversized bodies. */
export async function fetchText(url: string, options: FetchJsonOptions = {}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
      redirect: options.redirect ?? "manual",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${url})`);
    }

    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Response too large (${url})`);
    }
    return buffer.toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}

/** Small JSON fetch helper with a hard timeout. Throws on non-2xx or invalid JSON. */
export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Invalid JSON from ${url}`);
  }
}
