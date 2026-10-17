// Web Crypto only, so this runs on Workers as well as Node.

function randomToken(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const generateIngestKey = () => `fsk_${randomToken(32)}`;
export const generateWebhookSecret = () => `whs_${randomToken(32)}`;

// Keys are 256-bit random, so a plain SHA-256 is enough; no salt needed.
export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
