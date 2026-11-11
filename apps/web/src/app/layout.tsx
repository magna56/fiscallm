import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AdClickCapture } from "@/components/ad-conversion";
import { SiteAnalytics } from "@/components/site-analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "FiscaLLM: track Claude Code spend per developer, free and open source";
const DESCRIPTION =
  "See what each developer and team spends in Claude Code, with budget alerts. Five settings, no proxy, prompts never stored. Also AI limits by plan and AI cost per user for the products you sell. Open source.";

export const metadata: Metadata = {
  metadataBase: new URL("https://fiscallm.com"),
  verification: { other: { "msvalidate.01": "45DBEA58E8AD4145DC54FC72D77D244C" } },
  keywords: ["Claude Code cost per developer", "Claude Code usage tracking", "Claude Code spend by team", "Claude Code budget alerts", "coding agent cost tracking", "AI usage limits per plan", "limit AI usage per user", "AI message limit free tier", "RevenueCat AI limits", "AI cost per user", "LLM cost tracking", "OpenAI cost per user", "RevenueCat AI margin", "AI app unit economics", "token cost tracking"],
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "FiscaLLM", title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: "/", types: { "application/rss+xml": "/guides/rss.xml", "text/plain": "/llms.txt" } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SiteAnalytics />
        <AdClickCapture />
      </body>
    </html>
  );
}
