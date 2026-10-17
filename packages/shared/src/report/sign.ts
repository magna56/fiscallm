// Signed unsubscribe links: the email link carries the app id and an HMAC,
// so it works without signing in and cannot be forged for other apps.

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsubscribe:${message}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const unsubscribeToken = (secret: string, appId: string) => hmac(secret, appId);

export async function verifyUnsubscribeToken(secret: string, appId: string, token: string) {
  const expected = await hmac(secret, appId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
