import { sourceInfo } from "@fiscallm/shared/sources";
import Link from "next/link";
import type { ReactNode } from "react";
import { GuideShell } from "@/components/guide-shell";

// A guide page for one source, built from its entry in the shared catalog
// (packages/shared/src/sources.ts), so the settings shown here are the ones
// the dashboard's Sources page fills in.

const BASE = "https://fiscallm.com";

export function SourceGuide({
  id,
  title,
  description,
  path,
  intro,
  faq,
  children,
}: {
  id: string;
  title: string;
  description: string;
  path: string;
  intro: ReactNode;
  faq: [string, string][];
  children?: ReactNode;
}) {
  const s = sourceInfo(id);
  if (!s) throw new Error(`unknown source ${id}`);
  return (
    <GuideShell title={title} description={description} path={path} crumb={{ href: "/integrations", label: "Integrations" }} faq={faq}>
      <p>
        <strong>In short:</strong> {intro}
      </p>
      {!s.verifiedLive && (
        <p>
          <strong>Beta.</strong> This source is built and tested against the format {s.name} publishes, but has not yet been run against a live account. If
          something looks off, <a href="https://github.com/magna56/fiscallm/issues/new?labels=source">open an issue</a>.
        </p>
      )}

      <h2 id="setup">Set it up</h2>
      {s.key ? (
        <ol>
          <li>
            <Link href="/login">Create an app</Link> in FiscaLLM (free).
          </li>
          <li>
            {s.key.help} (<a href={s.key.url}>open</a>)
          </li>
          <li>
            Paste the key on the app&apos;s <strong>Sources</strong> page under {s.name} and press Connect. The key is checked, stored encrypted, and used only
            to read usage. The last 30 days are read at once, then new usage once a day.
          </li>
        </ol>
      ) : (
        <>
          <p>
            <Link href="/login">Create an app</Link> in FiscaLLM (free) and copy its ingest key. The app&apos;s <strong>Sources</strong> page shows these
            settings with your key filled in.
          </p>
          {s.setup?.("fsk_your_key", BASE).map((snip) => (
            <div key={snip.where}>
              <p>
                In <code>{snip.where}</code>:
              </p>
              <pre>
                <code>{snip.code}</code>
              </pre>
            </div>
          ))}
        </>
      )}

      <h2 id="what">What is read</h2>
      <ul>
        {s.user && <li>Who: {s.user}</li>}
        {s.cost && <li>Cost: {s.cost}</li>}
        <li>Prompts, code and responses are never read or stored.</li>
      </ul>
      {s.notes?.length ? (
        <>
          <h2 id="limits">Limits</h2>
          <ul>
            {s.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      ) : null}
      {children}
      <p>
        Using more than one AI tool? Each one is a source you turn on in the same app, and the overview shows the cost of each tool, developer and model side by
        side. See <Link href="/integrations">all integrations</Link>.
      </p>
    </GuideShell>
  );
}
