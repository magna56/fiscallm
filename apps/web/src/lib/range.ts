import { lastDays, type Range } from "@fiscallm/shared/metrics";

export const RANGE_DAYS = [7, 30, 90] as const;

export function rangeFrom(searchParams: Record<string, string | string[] | undefined>): { days: number; range: Range } {
  const n = Number(searchParams.days);
  const days = (RANGE_DAYS as readonly number[]).includes(n) ? n : 30;
  return { days, range: lastDays(days) };
}
