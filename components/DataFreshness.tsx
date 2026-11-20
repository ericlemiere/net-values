"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Checks at most this often, however often the tab is shown. */
const MIN_GAP_MS = 30_000;

/** Module scope, so a re-render after a refresh can't skip the gap. */
let lastCheck = 0;

/**
 * Postgres's timestamp text ("2026-11-20 11:05:46.341271+00") as epoch ms.
 * Chrome parses that as is, but Safari, the browser this is mostly for,
 * returns NaN, so it's rewritten as ISO 8601 first: a T, milliseconds, and a
 * full offset.
 */
function toMs(stamp: string | null): number {
  if (!stamp) return 0;
  const iso = stamp
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d\d)$/, "$1:00");
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Brings an open page up to date after the morning job. A tab left open
 * overnight, or one iOS Safari restores from its own saved copy when the app
 * comes back (it reruns the page's scripts, which is why the logo draws, but
 * doesn't ask the server for new HTML), would otherwise keep yesterday's
 * numbers until a manual reload.
 *
 * On load and whenever the tab is shown again, asks /api/updated when the data
 * last changed. If that's later than the date this page was rendered with, a
 * router refresh re-renders the server components in place: new numbers, no
 * full reload, and no replay of the intro.
 */
export function DataFreshness({ updatedAt }: { updatedAt: string | null }) {
  const router = useRouter();

  useEffect(() => {
    const rendered = toMs(updatedAt);
    let stopped = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastCheck < MIN_GAP_MS) return;
      lastCheck = now;
      try {
        const res = await fetch("/api/updated", { cache: "no-store" });
        if (!res.ok) return;
        const { updatedAt: latest } = (await res.json()) as { updatedAt: string | null };
        if (!stopped && toMs(latest) > rendered) router.refresh();
      } catch {
        // Offline or the request failed: the page stays as it is.
      }
    }

    check();
    document.addEventListener("visibilitychange", check);
    // Back/forward cache restores fire pageshow, not visibilitychange.
    window.addEventListener("pageshow", check);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [updatedAt, router]);

  return null;
}
