import { defineConfig } from "vitest/config";

// The database tests start an in-memory Postgres (PGlite) and run migrations,
// which can take a few seconds on a cold or busy machine.
export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } });
