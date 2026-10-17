import "server-only";
import { schema } from "@fiscallm/shared";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb } from "./db";
import { createClient } from "./supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The app, if the signed-in user owns it; 404 otherwise. */
export async function requireApp(appId: string) {
  const user = await requireUser();
  if (!UUID.test(appId)) notFound();
  const [app] = await getDb()
    .select()
    .from(schema.apps)
    .where(and(eq(schema.apps.id, appId), eq(schema.apps.ownerId, user.id)));
  if (!app) notFound();
  return app;
}
