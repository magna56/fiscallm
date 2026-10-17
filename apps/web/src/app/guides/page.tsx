import type { Metadata } from "next";
import Link from "next/link";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "Guides · FiscaLLM",
  description: "Practical guides on tracking AI cost per user and protecting your margins.",
  alternates: { canonical: "/guides" },
};

const GUIDES = [
  {
    href: "/guides/track-openai-cost-per-user",
    title: "How to track OpenAI cost per user",
    body: "Read the usage object, price it, store it per user, and compare it with what each user pays.",
  },
];

export default function GuidesPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>Guides</h1>
        <p>Practical write-ups on AI cost per user and protecting your margins.</p>
        <ul className="!list-none !pl-0">
          {GUIDES.map((g) => (
            <li key={g.href} className="!my-4 rounded-2xl border border-black/5 bg-white p-5">
              <Link href={g.href} className="!no-underline text-lg font-semibold text-foreground">
                {g.title}
              </Link>
              <p className="!my-1">{g.body}</p>
            </li>
          ))}
        </ul>
      </Prose>
      <SiteFooter />
    </div>
  );
}
