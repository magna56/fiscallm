import Link from "next/link";
import type { ReactNode } from "react";
import { Prose, SiteFooter, SiteHeader } from "./site";

/** Shared frame for the SEO guides: header, breadcrumb, article JSON-LD, footer. */
export function GuideShell({ title, description, path, children }: { title: string; description: string; path: string; children: ReactNode }) {
  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    author: { "@type": "Organization", name: "FiscaLLM" },
    publisher: { "@type": "Organization", name: "FiscaLLM", logo: { "@type": "ImageObject", url: "https://fiscallm.com/icon.svg" } },
    mainEntityOfPage: `https://fiscallm.com${path}`,
  };
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <Prose>
        <p className="!mb-0 text-sm text-muted">
          <Link href="/guides">Guides</Link>
        </p>
        <h1>{title}</h1>
        {children}
      </Prose>
      <SiteFooter />
    </div>
  );
}
