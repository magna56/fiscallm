import "server-only";
import { schema } from "@fiscallm/shared";
import { count, eq, max } from "drizzle-orm";
import { getDb } from "./db";

export interface SetupState {
  aiEvents: number;
  lastAi: Date | null;
  revenueEvents: number;
  lastRevenue: Date | null;
  complete: boolean;
}

/** How far an app is through setup: usage arriving, revenue arriving. */
export async function setupState(appId: string): Promise<SetupState> {
  const db = getDb();
  const [ai] = await db.select({ n: count(), last: max(schema.aiEvents.ts) }).from(schema.aiEvents).where(eq(schema.aiEvents.appId, appId));
  const [rc] = await db.select({ n: count(), last: max(schema.rcEvents.eventTs) }).from(schema.rcEvents).where(eq(schema.rcEvents.appId, appId));
  return {
    aiEvents: ai?.n ?? 0,
    lastAi: ai?.last ?? null,
    revenueEvents: rc?.n ?? 0,
    lastRevenue: rc?.last ?? null,
    complete: (ai?.n ?? 0) > 0 && (rc?.n ?? 0) > 0,
  };
}
