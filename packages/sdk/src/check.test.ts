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
    expect(await meter.check("heavy")).toEqual({ allow: false, reason: "daily AI budget reached ($6.00 of $5.00)", spentToday: 6, spent30d: 26 });
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
    expect(await meter.check("a")).toEqual({ allow: true });
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await meter.check("b")).toEqual({ allow: true });
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect(await meter.check("c")).toEqual({ allow: true });
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect(await meter.check("d")).toEqual({ allow: true });
  });

  it("warns once about a refused key, and still allows", async () => {
    fetchMock.mockResolvedValue(json({ error: "invalid ingest key" }, 401));
    const meter = createMeter({ apiKey: "bad", logger: quiet });
    expect(await meter.check("a")).toEqual({ allow: true });
    expect(await meter.check("b")).toEqual({ allow: true });
    expect(quiet.warn).toHaveBeenCalledTimes(1);
  });

  it("allows without a key, without a user, and when disabled; no network", async () => {
    expect(await createMeter({ apiKey: undefined, logger: quiet }).check("u")).toEqual({ allow: true });
    expect(await createMeter({ apiKey: "k", logger: quiet }).check("")).toEqual({ allow: true });
    expect(await createMeter({ apiKey: "k", disabled: true }).check("u")).toEqual({ allow: true });
    vi.stubEnv("FISCALLM_DISABLED", "1");
    expect(await createMeter({ apiKey: "k" }).check("u")).toEqual({ allow: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
