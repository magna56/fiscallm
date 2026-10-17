import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const TITLE = "FiscaLLM: AI cost per user for subscription apps";
const DESCRIPTION = "See what each user costs you in AI, against what they pay. Per user, plan and free trial.";

export const metadata: Metadata = {
  metadataBase: new URL("https://fiscallm.com"),
  alternates: { canonical: "/" },
  keywords: ["AI cost per user", "LLM cost tracking", "OpenAI cost per user", "RevenueCat AI margin", "AI app unit economics", "token cost tracking"],
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "FiscaLLM", title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
      </body>
    </html>
  );
}
