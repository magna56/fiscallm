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

const TITLE = "FiscaLLM: AI usage limits by plan, and AI cost per user";
const DESCRIPTION =
  "Give free, trial and paid plans their own AI limits, show users how much is left, and see what each user costs you in AI against what they pay. Open source.";

export const metadata: Metadata = {
  metadataBase: new URL("https://fiscallm.com"),
  verification: { other: { "msvalidate.01": "45DBEA58E8AD4145DC54FC72D77D244C" } },
  keywords: ["AI usage limits per plan", "limit AI usage per user", "AI message limit free tier", "RevenueCat AI limits", "AI cost per user", "LLM cost tracking", "OpenAI cost per user", "RevenueCat AI margin", "AI app unit economics", "token cost tracking"],
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
