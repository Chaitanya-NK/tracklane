"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js (offline page + push) in production builds. In development it would serve
 * the offline page whenever the dev server restarts, so it stays off there.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Unsupported or blocked (private mode, http on a non-localhost host): the app works without it.
    });
  }, []);
  return null;
}
