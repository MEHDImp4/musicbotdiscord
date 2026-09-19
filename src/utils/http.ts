export interface FetchJsonOptions {
  timeoutMs?: number;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/** Small JSON fetch helper with a hard timeout. Throws on non-2xx. */
export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${url})`);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}
