// Copies the price table and the cost maths from packages/shared into the
// SDK, so `fiscallm/prices` ships the same numbers the hosted service uses
// and the SDK keeps zero dependencies. Run after changing a price:
//   node scripts/sync-prices.mjs
// src/prices/prices.test.ts fails when the copies are out of date.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const FILES = ["cost", "prices", "public"];
const from = (name) => fileURLToPath(new URL(`../../shared/src/pricing/${name}.ts`, import.meta.url));
const to = (name) => fileURLToPath(new URL(`../src/prices/${name}.ts`, import.meta.url));

/** The SDK's copy of a shared pricing file: a header, and ".js" on relative imports (plain ESM needs it). */
export function generated(name) {
  const source = readFileSync(from(name), "utf8").replace(/from "\.\/(cost|prices)"/g, 'from "./$1.js"');
  return `// Generated from packages/shared/src/pricing/${name}.ts by scripts/sync-prices.mjs. Do not edit.\n${source}`;
}
export const current = (name) => readFileSync(to(name), "utf8");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const name of FILES) writeFileSync(to(name), generated(name));
  console.log(`synced ${FILES.length} files into src/prices`);
}
