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

const TITLE = "FiscaLLM: AI spend per developer across Claude Code, Codex, Cursor and more";
const DESCRIPTION =
  "See what each developer and team spends on AI: Claude Code, Codex, Cursor, Gemini CLI, and the OpenAI and Anthropic APIs, with budget alerts. No proxy, prompts never stored. Also AI limits by plan and AI cost per user for products. Free and open source.";

export const metadata: Metadata = {
  metadataBase: new URL("https://fiscallm.com"),
  verification: { other: { "msvalidate.01": "45DBEA58E8AD4145DC54FC72D77D244C" } },
  keywords: ["AI spend per developer", "Codex CLI cost tracking", "Cursor spend per developer", "Gemini CLI usage tracking", "OpenAI usage per user", "Claude Code cost per developer", "Claude Code usage tracking", "Claude Code spend by team", "Claude Code budget alerts", "coding agent cost tracking", "AI usage limits per plan", "limit AI usage per user", "AI message limit free tier", "RevenueCat AI limits", "AI cost per user", "LLM cost tracking", "OpenAI cost per user", "RevenueCat AI margin", "AI app unit economics", "token cost tracking"],
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
