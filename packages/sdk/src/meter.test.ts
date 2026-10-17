import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMeter, type TrackEvent } from "./meter.js";

const ev: TrackEvent = { userId: "u1", provider: "openai", model: "gpt-4o", inputTokens: 10, outputTokens: 5 };
const quiet = { warn: vi.fn() };

let fetchMock: ReturnType<typeof vi.fn>;
const bodies = () => fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).events);

function respond(...statuses: (number | Error)[]) {
  for (const s of statuses) {
    if (s instanceof Error) fetchMock.mockRejectedValueOnce(s);
    else fetchMock.mockResolvedValueOnce(new Response("{}", { status: s }));
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  quiet.warn.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createMeter", () => {
  it("sends events from one request in one batch after the waitUntil window", async () => {
    const kept: Promise<unknown>[] = [];
    const meter = createMeter({ apiKey: "k", waitUntil: (p) => kept.push(p), logger: quiet });
    meter.track(ev);
    meter.track({ ...ev, userId: "u2" });
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60);
    await Promise.all(kept);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [batch] = bodies();
    expect(batch).toHaveLength(2);
    expect(batch[0]).toMatchObject({ userId: "u1", provider: "openai", model: "gpt-4o", inputTokens: 10, outputTokens: 5, cachedTokens: 0 });
    expect(batch[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(batch[0].id).not.toBe(batch[1].id);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://aispendbook.vercel.app/api/v1/events");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer k" });
  });

  it("every waitUntil promise settles", async () => {
    const kept: Promise<unknown>[] = [];
    const meter = createMeter({ apiKey: "k", waitUntil: (p) => kept.push(p), logger: quiet });
    meter.track(ev);
    await meter.flush(); // before the window ends
    let settled = 0;
    kept.forEach((p) => p.then(() => settled++));
    await vi.runAllTimersAsync();
    expect(settled).toBe(kept.length);
  });

  it("flush sends immediately without waitUntil", async () => {
    const meter = createMeter({ apiKey: "k", logger: quiet });
    meter.track(ev);
    await meter.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends on an interval on long-running servers", async () => {
    const meter = createMeter({ apiKey: "k", logger: quiet });
    meter.track(ev);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("splits into batches of 100", async () => {
    const meter = createMeter({ apiKey: "k", logger: quiet });
    for (let i = 0; i < 250; i++) meter.track(ev);
    await meter.flush();
    expect(bodies().map((b) => b.length)).toEqual([100, 100, 50]);
  });

  it("retries once on a network error or 5xx, resending the same ids", async () => {
    respond(new Error("down"), 202);
    const meter = createMeter({ apiKey: "k", logger: quiet });
    meter.track(ev);
    const done = meter.flush();
    await vi.advanceTimersByTimeAsync(300);
    await done;
    const [a, b] = bodies();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(a[0].id).toBe(b[0].id);
    expect(quiet.warn).not.toHaveBeenCalled();
  });

  it("drops after the retry fails and warns once", async () => {
    respond(500, 503, 500, 500);
    const meter = createMeter({ apiKey: "k", logger: quiet });
    for (const _ of [1, 2]) {
      meter.track(ev);
      const done = meter.flush();
      await vi.advanceTimersByTimeAsync(300);
      await done;
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(quiet.warn).toHaveBeenCalledTimes(1);
  });

  it("does not retry a rejected batch and says why", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"invalid ingest key"}', { status: 401 }));
    const meter = createMeter({ apiKey: "bad", logger: quiet });
    meter.track(ev);
    await meter.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(quiet.warn.mock.calls[0]![0]).toContain("invalid ingest key");
  });

  it("never throws, even when fetch throws synchronously", async () => {
    fetchMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const meter = createMeter({ apiKey: "k", logger: quiet });
    expect(() => meter.track(ev)).not.toThrow();
    const done = meter.flush();
    await vi.advanceTimersByTimeAsync(300);
    await expect(done).resolves.toBeUndefined();
  });

  it("is a no-op without an api key", async () => {
    const meter = createMeter({ apiKey: undefined, logger: quiet });
    meter.track(ev);
    await meter.flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(quiet.warn).toHaveBeenCalledTimes(1);
  });

  it("skips invalid events and cleans up numbers", async () => {
    const meter = createMeter({ apiKey: "k", logger: quiet });
    meter.track({ ...ev, userId: "" });
    meter.track({ ...ev, inputTokens: -5, outputTokens: 2.6, cachedTokens: NaN, costUsd: -1, ts: "garbage" });
    await meter.flush();
    const [batch] = bodies();
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({ inputTokens: 0, outputTokens: 3, cachedTokens: 0 });
    expect(batch[0].costUsd).toBeUndefined();
    expect(Number.isNaN(Date.parse(batch[0].ts))).toBe(false);
  });

  it("survives a waitUntil that throws", async () => {
    const meter = createMeter({
      apiKey: "k",
      waitUntil: () => {
        throw new TypeError("Illegal invocation");
      },
      logger: quiet,
    });
    meter.track(ev);
    await vi.advanceTimersByTimeAsync(60);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(quiet.warn.mock.calls[0]![0]).toContain("bind(ctx)");
  });
});
