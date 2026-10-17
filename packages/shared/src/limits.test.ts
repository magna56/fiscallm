import { describe, expect, it } from "vitest";
import { monthlyEventCap, monthStart, nextMonthStart } from "./limits";

describe("monthlyEventCap", () => {
  it("is off unless set to a positive whole number", () => {
    expect(monthlyEventCap(undefined)).toBeNull();
    expect(monthlyEventCap("")).toBeNull();
    expect(monthlyEventCap("0")).toBeNull();
    expect(monthlyEventCap("-5")).toBeNull();
    expect(monthlyEventCap("abc")).toBeNull();
    expect(monthlyEventCap("1.5")).toBeNull();
    expect(monthlyEventCap("100000")).toBe(100000);
  });
});

describe("month boundaries (UTC)", () => {
  it("finds the start of this and the next month", () => {
    const now = new Date("2026-10-18T23:30:00Z");
    expect(monthStart(now)).toBe("2026-10-01");
    expect(nextMonthStart(now)).toBe("2026-11-01");
    expect(nextMonthStart(new Date("2026-12-31T23:59:00Z"))).toBe("2027-01-01");
  });
});
