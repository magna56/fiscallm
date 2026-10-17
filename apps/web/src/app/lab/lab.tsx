"use client";

import { Purchases, type Package } from "@revenuecat/purchases-js";
import { useState } from "react";
import { askAI, type AskResult } from "./actions";

// RevenueCat Test Store key: a public client key, safe to ship in a page.
const RC_TEST_KEY = "test_nZKZdZaXCHQjMrHtXiqFvNWoNeA";

export function Lab({ dashboardUrl }: { dashboardUrl: string }) {
  const [userId, setUserId] = useState("lab-user-1");
  const [packages, setPackages] = useState<Package[]>([]);
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState<"gemini" | "openai">("gemini");
  const [prompt, setPrompt] = useState("Write a two-line poem about subscription apps.");
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPlans() {
    setStatus("Loading plans…");
    try {
      const purchases = Purchases.configure({ apiKey: RC_TEST_KEY, appUserId: userId });
      const offerings = await purchases.getOfferings();
      setPackages(offerings.current?.availablePackages ?? []);
      setStatus(offerings.current ? "" : "No current offering in RevenueCat.");
    } catch (e) {
      setStatus(`RevenueCat error: ${(e as Error).message}`);
    }
  }

  async function buy(pkg: Package) {
    setStatus("Opening the Test Store…");
    try {
      await Purchases.getSharedInstance().purchase({ rcPackage: pkg });
      setStatus(`Bought ${pkg.identifier} as ${userId}. The webhook reaches FiscaLLM within a minute.`);
    } catch (e) {
      setStatus(`Purchase not completed: ${(e as Error).message}`);
    }
  }

  async function ask() {
    setBusy(true);
    setAnswer(null);
    try {
      setAnswer(await askAI(userId, provider, prompt));
    } finally {
      setBusy(false);
    }
  }

  const field = "rounded border border-foreground/20 bg-transparent px-3 py-1.5 text-sm";
  const button = "rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-foreground/10 p-5">
        <h2 className="mb-2 font-medium">1. Pick a test user</h2>
        <p className="mb-3 text-sm text-foreground/70">Used as both the RevenueCat app user ID and the FiscaLLM userId, as a real app would.</p>
        <input className={field} value={userId} onChange={(e) => { setUserId(e.target.value); setPackages([]); }} />
      </section>

      <section className="rounded-lg border border-foreground/10 p-5">
        <h2 className="mb-2 font-medium">2. Buy a plan in the RevenueCat Test Store</h2>
        <button className={button} onClick={loadPlans} disabled={!userId}>Load plans</button>
        <ul className="mt-3 flex flex-col gap-2">
          {packages.map((p) => (
            <li key={p.identifier} className="flex items-center justify-between gap-3 text-sm">
              <span>{p.webBillingProduct?.title ?? p.identifier} – {p.webBillingProduct?.currentPrice?.formattedPrice ?? ""}</span>
              <button className={button} onClick={() => buy(p)}>Buy</button>
            </li>
          ))}
        </ul>
        {status && <p className="mt-3 text-sm text-foreground/70">{status}</p>}
      </section>

      <section className="rounded-lg border border-foreground/10 p-5">
        <h2 className="mb-2 font-medium">3. Use AI as this user</h2>
        <div className="flex flex-col gap-2">
          <select className={field} value={provider} onChange={(e) => setProvider(e.target.value as "gemini" | "openai")}>
            <option value="gemini">Gemini 3.8 Flash</option>
            <option value="openai">OpenAI GPT-4.1 nano</option>
          </select>
          <textarea className={field} rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button className={button} onClick={ask} disabled={busy}>{busy ? "Asking…" : "Ask"}</button>
        </div>
        {answer && (
          <div className="mt-3 text-sm">
            <p className={answer.ok ? "" : "text-red-600"}>{answer.text}</p>
            {answer.ok && (
              <pre className="mt-2 overflow-x-auto rounded bg-foreground/5 p-2 text-xs">{JSON.stringify({ model: answer.model, usage: answer.usage }, null, 2)}</pre>
            )}
          </div>
        )}
      </section>

      <p className="text-sm">
        Then check the <a href={dashboardUrl} className="underline">dashboard</a>. Turn on test mode in Settings, since Test Store purchases are sandbox.
      </p>
    </div>
  );
}
