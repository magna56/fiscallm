import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMeter } from "./meter.js";

const quiet = { warn: vi.fn() };
let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  quiet.warn.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("meter.check", () => {
  it("asks the server and returns its answer", async () => {
    fetchMock.mockResolvedValueOnce(json({ allow: false, reason: "daily AI budget reached ($6.00 of $5.00)", spentToday: 6, spent30d: 26, dailyLimit: 5 }));
    const meter = createMeter({ apiKey: "k", logger: quiet });
    expect(await meter.check("heavy")).toEqual({ allow: false, reason: "daily AI budget reached ($6.00 of $5.00)", spentToday: 6, spent30d: 26, source: "server" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://fiscallm.com/api/v1/check");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer k" });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ userId: "heavy" });
  });

  it("uses the endpoint's host when one is set", async () => {
    fetchMock.mockResolvedValueOnce(json({ allow: true }));
    await createMeter({ apiKey: "k", endpoint: "http://localhost:8787/api/v1/events", logger: quiet }).check("u");
    expect(fetchMock.mock.calls[0]![0]).toBe("http://localhost:8787/api/v1/check");
  });

  it("remembers an answer for a few seconds", async () => {
    fetchMock.mockResolvedValue(json({ allow: true, spentToday: 1 }));
    const meter = createMeter({ apiKey: "k", logger: quiet });
    await meter.check("u");
    await meter.check("u");
    await meter.check("other");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails open on server errors, timeouts, bad bodies and network errors", async () => {
    const meter = createMeter({ apiKey: "k", logger: quiet });
    fetchMock.mockResolvedValueOnce(json({ error: "boom" }, 500));
    expect(await meter.check("a")).toMatchObject({ allow: true });
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await meter.check("b")).toMatchObject({ allow: true });
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect(await meter.check("c")).toMatchObject({ allow: true });
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect(await meter.check("d")).toMatchObject({ allow: true });
  });

  it("warns once about a refused key, and still allows", async () => {
    fetchMock.mockResolvedValue(json({ error: "invalid ingest key" }, 401));
    const meter = createMeter({ apiKey: "bad", logger: quiet });
    expect(await meter.check("a")).toMatchObject({ allow: true });
    expect(await meter.check("b")).toMatchObject({ allow: true });
    expect(quiet.warn).toHaveBeenCalledTimes(1);
  });

  it("allows without a key, without a user, and when disabled; no network", async () => {
    expect(await createMeter({ apiKey: undefined, logger: quiet }).check("u")).toMatchObject({ allow: true });
    expect(await createMeter({ apiKey: "k", logger: quiet }).check("")).toMatchObject({ allow: true });
    expect(await createMeter({ apiKey: "k", disabled: true }).check("u")).toMatchObject({ allow: true });
    vi.stubEnv("FISCALLM_DISABLED", "1");
    expect(await createMeter({ apiKey: "k" }).check("u")).toMatchObject({ allow: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps refusing a refused user while FiscaLLM is unreachable", async () => {
    vi.useFakeTimers();
    try {
      const meter = createMeter({ apiKey: "k", logger: quiet });
      fetchMock.mockResolvedValueOnce(json({ allow: false, reason: "daily AI budget reached ($6.00 of $5.00)" }));
      expect((await meter.check("heavy")).allow).toBe(false);
      vi.advanceTimersByTime(6000); // past the 5-second cache
      fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
      expect(await meter.check("heavy")).toMatchObject({ allow: false, reason: "daily AI budget reached ($6.00 of $5.00)", source: "last-known" });
      fetchMock.mockRejectedValueOnce(new Error("network"));
      expect(await meter.check("someone-else")).toEqual({ allow: true, source: "unreachable" });
      // Once FiscaLLM allows them again, an outage no longer refuses them.
      vi.advanceTimersByTime(6000);
      fetchMock.mockResolvedValueOnce(json({ allow: true }));
      expect((await meter.check("heavy")).allow).toBe(true);
      vi.advanceTimersByTime(6000);
      fetchMock.mockRejectedValueOnce(new Error("network"));
      expect((await meter.check("heavy")).allow).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails closed when checkOnError is deny", async () => {
    const meter = createMeter({ apiKey: "k", logger: quiet, checkOnError: "deny" });
    fetchMock.mockResolvedValueOnce(json({ error: "boom" }, 503));
    expect(await meter.check("a")).toMatchObject({ allow: false, source: "unreachable" });
    fetchMock.mockResolvedValueOnce(json({ allow: true }));
    expect((await meter.check("b")).allow).toBe(true);
  });

  it("enforces the local limit with no network call, then lets the user back after the window", async () => {
    vi.useFakeTimers();
    try {
      const meter = createMeter({ apiKey: undefined, logger: quiet, localLimit: { requests: 3, windowSeconds: 60 } });
      const call = { userId: "loop", provider: "openai", model: "gpt-4o", inputTokens: 10 };
      for (let i = 0; i < 3; i++) {
        expect((await meter.check("loop")).allow).toBe(true);
        meter.track(call);
      }
      expect(await meter.check("loop")).toMatchObject({ allow: false, reason: "local limit: 3 AI calls in 1 minute", source: "local" });
      expect((await meter.check("other")).allow).toBe(true);
      vi.advanceTimersByTime(61_000);
      expect((await meter.check("loop")).allow).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts tokens and exact cost toward the local limit", async () => {
    const meter = createMeter({ apiKey: undefined, logger: quiet, localLimit: { tokens: 1000, costUsd: 1 } });
    meter.track({ userId: "t", provider: "openai", model: "m", inputTokens: 600, outputTokens: 400 });
    expect((await meter.check("t")).reason).toBe("local limit: 1000 tokens in 5 minutes");
    meter.track({ userId: "c", provider: "fal", model: "veo", costUsd: 1.2 });
    expect((await meter.check("c")).reason).toBe("local limit: $1.20 in 5 minutes");
  });
});
