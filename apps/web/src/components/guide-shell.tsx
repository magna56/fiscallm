import Link from "next/link";
import type { ReactNode } from "react";
import { Prose, SiteFooter, SiteHeader } from "./site";

/** Shared frame for the guides and integration pages: header, breadcrumb, article JSON-LD, footer. */
export function GuideShell({
  title,
  description,
  path,
  crumb = { href: "/guides", label: "Guides" },
  faq,
  children,
}: {
  title: string;
  description: string;
  path: string;
  crumb?: { href: string; label: string };
  /** Questions answered on the page, also published as FAQPage JSON-LD. */
  faq?: [string, string][];
  children: ReactNode;
}) {
  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    author: { "@type": "Organization", name: "FiscaLLM" },
    publisher: { "@type": "Organization", name: "FiscaLLM", logo: { "@type": "ImageObject", url: "https://fiscallm.com/icon.svg" } },
    mainEntityOfPage: `https://fiscallm.com${path}`,
  };
  const faqPage = faq && {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      {faqPage && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }} />}
      <Prose>
        <p className="!mb-0 text-sm text-muted">
          <Link href={crumb.href}>{crumb.label}</Link>
        </p>
        <h1>{title}</h1>
        {children}
        {faq && (
          <>
            <h2 id="faq">Questions</h2>
            {faq.map(([q, a]) => (
              <div key={q}>
                <h3>{q}</h3>
                <p>{a}</p>
              </div>
            ))}
          </>
        )}
      </Prose>
      <SiteFooter />
    </div>
  );
}
