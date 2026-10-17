import { CopyButton } from "./copy-button";

export const SKILL_INSTALL =
  "mkdir -p .claude/skills/fiscallm-setup && curl -fsSL https://fiscallm.com/skill.md -o .claude/skills/fiscallm-setup/SKILL.md";
export const SKILL_PROMPT = "Read https://fiscallm.com/skill.md and follow it to set up FiscaLLM in this project.";

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-foreground/60">{label}</div>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 rounded bg-foreground/5 px-2 py-1.5 font-mono text-xs break-all">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

/** Lets a coding assistant do the setup in the customer's codebase. */
export function AiSetup() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-foreground/70">
        Let your coding assistant find your AI calls, add the SDK and pass the RevenueCat user ID through. It shows you a plan before editing.
      </p>
      <Line label="Claude Code: install the skill in your project, then ask it to “set up FiscaLLM”" value={SKILL_INSTALL} />
      <Line label="Cursor, Copilot or any other assistant: paste this prompt" value={SKILL_PROMPT} />
    </div>
  );
}
