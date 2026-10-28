"use client";

import { useEffect, useRef } from "react";

/**
 * Whether the hero has already mounted in this page load.
 *
 * The watermark lives in the persistent layout, so its draw-on runs once per
 * full load and never again as you navigate. Module scope is exactly that
 * lifetime: it resets on a hard load and survives every client-side
 * navigation.
 *
 * It is only ever written from an effect, never during render, so the server
 * renders the same markup for every request and hydration matches.
 */
let heroHasMounted = false;

/**
 * Whether the hard load that started this page session was the home page
 * itself. If it was some other page, the watermark drew there, so by the time
 * you navigate home there is nothing left to wait for. The navigation entry
 * keeps the URL the browser actually loaded, whatever the client router has
 * done since.
 */
function loadedOnHome() {
  const [entry] = performance.getEntriesByType("navigation");
  return !entry || new URL(entry.name).pathname === "/";
}

/**
 * The home page's root: decides whether its rise-in waits for the logo to
 * draw. The content itself is the server page's, passed through as children.
 */
export function HomeIntro({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const decided = useRef(false);

  /*
   * The markup always asks for the wait — that's what the server emits, and
   * what the first load wants — so the correction is a class taken back off
   * the node rather than state, which keeps hydration identical either way.
   * It lands a frame late, which only shifts the animations by that frame.
   */
  useEffect(() => {
    // A ref, not the module flag, guards this: React's dev-mode double mount
    // would otherwise read back the value its own first pass just wrote.
    if (decided.current) return;
    decided.current = true;
    // Only the first mount on a load that began here coincides with the draw.
    if (heroHasMounted || !loadedOnHome()) {
      rootRef.current?.classList.remove("home-intro-wait");
    }
    heroHasMounted = true;
  }, []);

  return (
    <div
      ref={rootRef}
      className="home-intro home-intro-wait flex w-full max-w-5xl flex-1 flex-col p-6 pb-0 md:mt-12"
    >
      {children}
    </div>
  );
}
