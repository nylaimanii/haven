/**
 * Single-retry wrapper around fetch for upstream calls that occasionally
 * throttle or hiccup (Open-Meteo's batched Forecast API does this for legit
 * 256-point requests — observed empirically: a request that 502s often
 * succeeds 500ms later from the same IP). One retry is enough to mask the
 * transient failure; if it still fails, the caller treats it as a real error.
 *
 * Only retries on network errors and 5xx responses. 4xx (bad request) skips
 * retry — that's our bug, not theirs.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  retryDelayMs = 500,
): Promise<Response> {
  try {
    const r = await fetch(url, init);
    if (r.ok || (r.status >= 400 && r.status < 500)) return r;
    // 5xx — retry once
  } catch {
    // network error — retry once
  }
  await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  return fetch(url, init);
}
