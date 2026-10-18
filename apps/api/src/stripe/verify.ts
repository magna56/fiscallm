// Stripe signs every webhook: the Stripe-Signature header is
// "t=<unix seconds>,v1=<hex hmac>[,v1=...]" and the HMAC-SHA256 is computed
// over "<t>.<raw body>" with the endpoint's signing secret (whsec_...), used
// as is. No Stripe library needed.

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sign(payload: string, timestamp: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`)));
}

/** True when the header carries a valid, recent signature of the raw body. */
export async function verifyStripeSignature(
  payload: string,
  header: string | undefined,
  secret: string,
  nowMs = Date.now(),
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=");
    if (k === "t") timestamp = Number(v);
    else if (k === "v1" && v) signatures.push(v);
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowMs / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = await sign(payload, timestamp, secret);
  return signatures.some((s) => safeEqual(s, expected));
}
