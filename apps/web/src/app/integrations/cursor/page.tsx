import type { Metadata } from "next";
import { SourceGuide } from "@/components/source-guide";

const TITLE = "Cursor spend per developer";
const PATH = "/integrations/cursor";
const DESCRIPTION =
  "See what each member of your Cursor team spends, per model, read daily from Cursor's Admin API with one key. Next to Claude Code, Codex and your other AI tools. Free and open source.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "What does it need?",
    "A Cursor team (Teams or Enterprise) and an Admin API key, which a team admin creates in the team settings. Nothing is installed on developers' machines.",
  ],
  [
    "Which amount is shown?",
    "What Cursor charged for each usage-based request. For requests included in the plan, the model cost Cursor reports, which shows what that usage is worth.",
  ],
  [
    "How fresh is it?",
    "Read once a day and whenever you press Sync now. Cursor's own data is about an hour behind, so the last two hours come with the next sync.",
  ],
  [
    "Cursor already has a usage page. Why this?",
    "To see Cursor next to the other AI tools your team uses, such as Claude Code and Codex, per developer, with budget alerts. If your team uses only Cursor, its dashboard may be enough.",
  ],
];

export default function Page() {
  return (
    <SourceGuide
      id="cursor"
      title={TITLE}
      description={DESCRIPTION}
      path={PATH}
      faq={FAQ}
      intro={
        <>
          paste a Cursor Admin API key on the Sources page. FiscaLLM reads every usage event of your team, with the member&apos;s email, the model, tokens and
          cost, and shows it next to your other AI tools.
        </>
      }
    />
  );
}
