// Encrypts short secrets at rest (AES-GCM, Web Crypto). The key is derived
// from a server secret, so the database alone cannot decrypt them.

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(serverSecret: string) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`fiscallm:secret-box:${serverSecret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(serverSecret: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(serverSecret), enc.encode(plaintext)));
  return `${b64(iv)}.${b64(cipher)}`;
}

export async function open(serverSecret: string, sealed: string): Promise<string> {
  const [iv, cipher] = sealed.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv!) }, await key(serverSecret), unb64(cipher!));
  return new TextDecoder().decode(plain);
}
