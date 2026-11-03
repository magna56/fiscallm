"use client";

import { useEffect } from "react";

// Google Ads sign-up tracking, only for visitors who arrived from one of our
// ads (a gclid in the URL). Everyone else never loads Google's script.
const TAG = "AW-18552913808";
const SIGNUP = `${TAG}/YfcGCPPngLEdEJD_245F`;
const MARKER = "fl_ad";

type Gtag = (...args: unknown[]) => void;

function loadGtag(): Gtag {
  const w = window as unknown as { dataLayer: unknown[]; gtag?: Gtag };
  if (!w.gtag) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() {
      // gtag.js reads the arguments object, not an array.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer.push(arguments);
    };
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${TAG}`;
    document.head.appendChild(s);
    w.gtag("js", new Date());
    w.gtag("config", TAG, { allow_ad_personalization_signals: false });
  }
  return w.gtag;
}

const hasMarker = () => document.cookie.split("; ").some((c) => c === `${MARKER}=1`);

/** On any page: remember an ad click, so a later sign-up can be counted. */
export function AdClickCapture() {
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("gclid")) return;
    document.cookie = `${MARKER}=1; max-age=${90 * 86_400}; path=/; samesite=lax; secure`;
    loadGtag();
  }, []);
  return null;
}

/** On the welcome page (shown once, after an account is created): count the sign-up. */
export function SignupConversion() {
  useEffect(() => {
    if (!hasMarker()) return;
    loadGtag()("event", "conversion", { send_to: SIGNUP });
    document.cookie = `${MARKER}=; max-age=0; path=/`;
  }, []);
  return null;
}
