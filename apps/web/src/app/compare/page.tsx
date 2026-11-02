import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT, Prose, SiteFooter, SiteHeader } from "@/components/site";
import { CHECKED, COMPETITORS, FISCALLM } from "@/lib/compare";

const TITLE = "AI cost per user tools compared: FiscaLLM, Weckr, MarginDash, MarginMeter, Langfuse, Helicone";
const DESCRIPTION =
  "Which tools track AI cost per user, which join it to real revenue to show margin, what they cost, and which are open source and self-hostable.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: "/compare" },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

export default function Compare() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>AI cost per user tools compared</h1>
        <p>
          Tracking what each user costs in AI is the first half. Knowing whether that user is profitable needs the second half: what they actually
          paid. Here is how the tools people ask us about handle both. Facts were checked on {CHECKED} from each vendor&apos;s public site; prices
          change, so check theirs too. We make FiscaLLM, so read this with that in mind, and{" "}
          <a href={`mailto:${CONTACT}`}>tell us</a> if anything is wrong.
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Price</th>
                <th>Open source</th>
                <th>Revenue for margin</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>FiscaLLM</strong></td>
                <td>{FISCALLM.pricing}</td>
                <td>{FISCALLM.openSource}</td>
                <td>{FISCALLM.revenue}</td>
              </tr>
              {COMPETITORS.map((c) => (
                <tr key={c.slug}>
                  <td>
                    <Link href={`/compare/fiscallm-vs-${c.slug}`}>{c.name}</Link>
                  </td>
                  <td>{c.pricing}</td>
                  <td>{c.openSource}</td>
                  <td>{c.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="how-to-choose">How to choose</h2>
        <ul>
          <li>
            <strong>You need margin, not just cost:</strong> pick a tool that imports what users paid. FiscaLLM and MarginDash do it per user, MarginMeter for the company as a whole;
            observability tools (Langfuse, Helicone) and plan-price estimates do not.
          </li>
          <li>
            <strong>You sell through the App Store or Google Play:</strong> you need RevenueCat support. FiscaLLM connects RevenueCat in one click.
          </li>
          <li>
            <strong>Revenue and usage data must stay on your servers:</strong> pick something you can self-host. FiscaLLM is MIT and self-hostable.
          </li>
          <li>
            <strong>You need prompt traces and evals:</strong> use Langfuse or Helicone for that, and FiscaLLM next to it for margin.
          </li>
        </ul>
        <p>
          <Link href="/demo">See FiscaLLM&apos;s demo dashboard</Link> or <Link href="/login">start free</Link>.
        </p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
