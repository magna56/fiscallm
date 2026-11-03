import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTACT, Prose, SiteFooter, SiteHeader } from "@/components/site";
import { CHECKED, COMPETITORS, FISCALLM, findCompetitor } from "@/lib/compare";

const PREFIX = "fiscallm-vs-";

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: `${PREFIX}${c.slug}` }));
}

const competitorOf = (slug: string) => (slug.startsWith(PREFIX) ? findCompetitor(slug.slice(PREFIX.length)) : undefined);

export async function generateMetadata({ params }: PageProps<"/compare/[slug]">): Promise<Metadata> {
  const c = competitorOf((await params).slug);
  if (!c) return {};
  const title = `FiscaLLM vs ${c.name}: ${c.name} alternative for AI cost and margin per user`;
  const description = `${c.name} and FiscaLLM compared on price, open source, self-hosting and whether margin uses real revenue. FiscaLLM is free, MIT and connects RevenueCat, Stripe or CSV.`;
  return {
    title: `${title} · FiscaLLM`,
    description,
    alternates: { canonical: `/compare/${PREFIX}${c.slug}` },
    openGraph: { type: "article", title, description },
  };
}

export default async function VsPage({ params }: PageProps<"/compare/[slug]">) {
  const c = competitorOf((await params).slug);
  if (!c) notFound();
  const rows: [string, string, string][] = [
    ["What it is", "AI cost per user joined to real revenue: margin per user, plan and free trial", c.kind],
    ["Price", FISCALLM.pricing, c.pricing],
    ["Hosting", FISCALLM.hosting, c.hosting],
    ["Open source", FISCALLM.openSource, c.openSource],
    ["Revenue used for margin", FISCALLM.revenue, c.revenue],
    ["Stripe", FISCALLM.stripe, c.stripe],
  ];
  const faq: [string, string][] = [
    [`Is FiscaLLM a free ${c.name} alternative?`, `Yes. FiscaLLM is free and open source (MIT): use the hosted service at fiscallm.com or run your own copy. ${c.name}: ${c.pricing}.`],
    [`Can I use FiscaLLM and ${c.name} together?`, `Yes. FiscaLLM only needs one tracking call after each AI request and a revenue source, so it runs next to other tools.`],
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Prose>
        <p className="!mb-0 text-sm text-muted">
          <Link href="/compare">Compare</Link>
        </p>
        <h1>FiscaLLM vs {c.name}</h1>
        <p>
          Both help you see what AI costs per user. The difference is what they compare it with, what they cost, and where your data lives. Checked on{" "}
          {CHECKED} from <a href={c.url} rel="nofollow noopener">{c.name}&apos;s public page</a>; we make FiscaLLM, so <a href={`mailto:${CONTACT}`}>tell us</a>{" "}
          if anything about {c.name} is out of date.
        </p>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>FiscaLLM</th>
              <th>{c.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b]) => (
              <tr key={k}>
                <td className="font-medium">{k}</td>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 id="them">Where {c.name} is strong</h2>
        <ul>
          {c.strengths.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p>Pick {c.name} if {c.pickThemIf}</p>

        <h2 id="us">Why teams pick FiscaLLM</h2>
        <ul>
          <li><strong>Free and open source.</strong> MIT, with the server, dashboard and SDKs in one repository. No per-event or per-seat price.</li>
          <li><strong>Self-hostable.</strong> Run it on your own Vercel and Postgres so revenue and usage data never leave your infrastructure.</li>
          <li><strong>Real revenue, from where you bill.</strong> One-click RevenueCat for App Store and Google Play apps, <Link href="/stripe">Stripe</Link> with 12 months of history, exact fees and any currency, CSV upload, or a revenue API.</li>
          <li><strong>Margin per user, plan and free trial,</strong> with alerts when a paying user starts losing you money, and optional per-user caps.</li>
          <li><strong>Never sees prompts.</strong> Only user IDs, model names and token counts. Reporting never blocks or slows your app.</li>
        </ul>
        <p>
          <Link href="/demo">Open the demo dashboard</Link> (sample data, no sign-up), read <Link href="/docs">the docs</Link>, or{" "}
          <Link href="/login">start free</Link>. All comparisons: <Link href="/compare">AI cost per user tools compared</Link>.
        </p>

        <h2 id="faq">Questions</h2>
        {faq.map(([q, a]) => (
          <div key={q}>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
      </Prose>
      <SiteFooter />
    </div>
  );
}
