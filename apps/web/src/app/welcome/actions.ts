"use server";

import { schema } from "@fiscallm/shared";
import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notifyNewSignup } from "@/lib/notify-signup";
import { ROLES, TEAM_SIZES } from "./profile-form";

function read(formData: FormData) {
  const text = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max);
  const pick = (k: string, allowed: string[]) => (allowed.includes(text(k, 40)) ? text(k, 40) : null);
  let website = text("website", 200) || null;
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  return { fullName: text("fullName", 100), company: text("company", 100), website, role: pick("role", ROLES), teamSize: pick("teamSize", TEAM_SIZES) };
}

async function save(formData: FormData, back: string) {
  const user = await requireUser();
  const values = read(formData);
  if (!values.fullName || !values.company) redirect(`${back}?error=${encodeURIComponent("Enter your name and company")}`);
  const db = getDb();
  const [existing] = await db.select({ id: schema.profiles.userId }).from(schema.profiles).where(eq(schema.profiles.userId, user.id)).limit(1);
  await db
    .insert(schema.profiles)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: schema.profiles.userId, set: { ...values, updatedAt: new Date() } });
  if (!existing) {
    // A brand-new account: tell the founder, after the response is sent.
    const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(schema.profiles);
    after(() => notifyNewSignup({ email: user.email ?? null, ...values, total }));
  }
}

export async function completeWelcome(formData: FormData) {
  await save(formData, "/welcome");
  redirect("/dashboard");
}

export async function updateProfile(formData: FormData) {
  await save(formData, "/account");
  revalidatePath("/account");
  redirect("/account?done=Saved");
}
