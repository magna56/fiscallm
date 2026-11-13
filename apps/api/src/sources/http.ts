import { SourceError } from "./types";

// Requests to providers' usage APIs, with errors a customer can act on.

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const floorHour = (ms: number) => Math.floor(ms / HOUR) * HOUR;

/** A non-negative whole count from a JSON field; anything else is 0. */
export const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? Math.min(Math.round(x), 2_000_000_000) : 0;
};

export async function getJson<T>(f: typeof fetch, name: string, url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await f(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new SourceError(`Could not reach ${name}. The next sync tries again.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new SourceError(`${name} refused the key (HTTP ${res.status}). It needs to be an admin key that can read usage.`, res.status);
  }
  if (res.status === 429) throw new SourceError(`${name} rate limit reached. The next sync continues from here.`, 429);
  if (!res.ok) throw new SourceError(`${name} answered HTTP ${res.status}. The next sync tries again.`, res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new SourceError(`${name} sent a response that is not JSON.`);
  }
}

/** The message for a key that fails a check, or null when it works. */
export async function checkWith(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    return e instanceof SourceError ? e.message : "The key could not be checked.";
  }
}
