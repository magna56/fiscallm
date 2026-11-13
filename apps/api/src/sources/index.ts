import { anthropic } from "./anthropic";
import { claudeCode } from "./claude-code";
import { codex } from "./codex";
import { cursor } from "./cursor";
import { geminiCli } from "./gemini-cli";
import { openai } from "./openai";
import type { LogSource, PullSource } from "./types";

// The registry. A new tool is one file in this folder, one line here, and
// one entry in packages/shared/src/sources.ts (its name and setup steps).

/** Tools that send their model calls as OpenTelemetry logs to /v1/otel/v1/logs. */
export const LOG_SOURCES: LogSource[] = [claudeCode, codex, geminiCli];

/** Providers whose usage API FiscaLLM reads with a key the customer saves. */
export const PULL_SOURCES: PullSource[] = [cursor, openai, anthropic];

export const pullSource = (id: string) => PULL_SOURCES.find((s) => s.id === id);
