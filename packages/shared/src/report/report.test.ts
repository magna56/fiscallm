import { describe, expect, it } from "vitest";
import { renderWeeklyReport, type WeeklyReport, weekRanges } from "./index";
import { unsubscribeToken, verifyUnsubscribeToken } from "./sign";

const base: WeeklyReport = {
  range: { from: "2026-10-12", to: "2026-10-19" },
  costUsd: 120,
  revenueUsd: 100,
  costShare: 1.2,
  marginUsd: -20,
  requests: 5000,
  previous: { costUsd: 80, revenueUsd: 100, marginUsd: 20 },
  losingUsers: [{ userId: "u<1>", state: "paid", productId: "pro", costUsd: 30, revenueUsd: 7, marginUsd: -23, requests: 900 }],
  losingPlans: [{ productId: "pro", users: 4, revenueUsd: 28, costUsd: 60, marginUsd: -32, costShare: 2.1 }],
  unpricedModels: ["x/mystery"],
};
const opts = { appName: "Acme & Co", dashboardUrl: "https://fiscallm.com/dashboard/a", unsubscribeUrl: "https://fiscallm.com/u?x=1" };

describe("weekRanges", () => {
  it("covers the 7 whole days before today, and the 7 before that", () => {
    expect(weekRanges(new Date("2026-10-19T08:00:00Z"))).toEqual({
      current: { from: "2026-10-12", to: "2026-10-19" },
      previous: { from: "2026-10-05", to: "2026-10-12" },
    });
  });
});

describe("renderWeeklyReport", () => {
  it("leads with a loss when AI cost exceeded revenue", () => {
    const r = renderWeeklyReport(base, opts);
    expect(r.subject).toBe("Acme & Co: AI cost exceeded revenue last week (−$20.00)");
    expect(r.text).toContain("AI cost: $120.00 (+50% vs previous week)");
    expect(r.text).toContain("u<1> (pro): cost $30.00, paid $7.00");
    expect(r.text).toContain("x/mystery");
    expect(r.text).toContain(opts.unsubscribeUrl);
  });

  it("escapes HTML from user data", () => {
    const { html } = renderWeeklyReport(base, opts);
    expect(html).toContain("u&#60;1&#62;");
    expect(html).toContain("Acme &#38; Co");
    expect(html).not.toContain("u<1>");
  });

  it("says when nobody lost money", () => {
    const r = renderWeeklyReport({ ...base, marginUsd: 50, costShare: 0.2, losingUsers: [], losingPlans: [], unpricedModels: [] }, opts);
    expect(r.subject).toBe("Acme & Co: AI was 20.0% of revenue last week");
    expect(r.html).toContain("No paying user cost more than they paid.");
    expect(r.html).not.toContain("negative margin");
  });
});

describe("unsubscribe tokens", () => {
  it("verify only for the same app and secret", async () => {
    const t = await unsubscribeToken("s", "app-1");
    expect(await verifyUnsubscribeToken("s", "app-1", t)).toBe(true);
    expect(await verifyUnsubscribeToken("s", "app-2", t)).toBe(false);
    expect(await verifyUnsubscribeToken("other", "app-1", t)).toBe(false);
    expect(await verifyUnsubscribeToken("s", "app-1", "nope")).toBe(false);
  });
});
