"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Page-view analytics for the public site only. Signed-in pages are dropped
// before anything is sent, since their URLs contain app IDs.
const PRIVATE = ["/dashboard", "/account", "/welcome", "/auth"];

function beforeSend(event: BeforeSendEvent) {
  const { pathname } = new URL(event.url);
  return PRIVATE.some((p) => pathname.startsWith(p)) ? null : event;
}

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
