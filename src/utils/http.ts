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
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Response too large (${url})`);
    }

    return await readBounded(response, maxBytes, url);
  } finally {
    clearTimeout(timer);
  }
}

async function readBounded(response: Response, maxBytes: number, url: string): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Response too large (${url})`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks).toString("utf8");
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
