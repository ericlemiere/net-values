"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { NAV_LINKS } from "@/components/NavLinks";

/**
 * Whether the watermark has already drawn itself in this page load.
 *
 * The watermark lives in the persistent layout, so its draw-on runs once per
 * full load and never again as you navigate. Module scope is exactly that
 * lifetime: it resets on a hard load and survives every client-side
 * navigation, which is the distinction the hero needs to know about.
 *
 * It is only ever written from an effect, never during render, so the server
 * renders the same markup for every request and hydration matches.
 */
let logoHasDrawn = false;

/*
 * The site nav plus a direct way into the advanced table, which the header
 * nav leaves behind the toggle on /stats. It sits right after Stats.
 */
const HOME_LINKS = NAV_LINKS.flatMap((link) =>
  link.href === "/stats"
    ? [link, { href: "/stats?type=advanced", label: "Advanced Stats" }]
    : [link],
);

// On short phones (the max-height variant) the grid tightens up so the logo
// under it still fits on screen.
const cardClass =
  "flex justify-center items-center text-center text-md md:text-lg font-bold rounded-md border border-accent bg-background-box/90 px-1 py-1.75 md:py-4 transition-colors hover:border-accent hover:bg-accent hover:text-black";

export function HomeIntro() {
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
    if (logoHasDrawn) rootRef.current?.classList.remove("home-intro-wait");
    logoHasDrawn = true;
  }, []);

  return (
    <div
      ref={rootRef}
      className="home-intro home-intro-wait flex flex-1 flex-col p-6 pb-0 md:mt-12"
    >
      <h1
        className="home-in mb-3 text-4xl md:text-6xl font-semibold tracking-tight"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        The Net Values
      </h1>
      <div
        className="home-in mb-4 md:mb-8 max-w-xl"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <p className="text-xl md:text-2xl font-semibold leading-snug tracking-tight">
          An &nbsp;
          <span className="inline-block rounded-md border-2 border-accent px-1.5 leading-tight text-accent font-mono animate-pulse shadow-[0_0_20px_5px_#fff20060]">
            AI
          </span>&nbsp;
          powered NBA player evaluator.
        </p>
        <p className="mt-2 text-white/70 md:text-lg">
          Weigh production against paycheck. Find the Net Value.
        </p>
      </div>
      <nav className="grid grid-cols-2 gap-3 md:gap-4 max-w-xl md:mt-8">
        {HOME_LINKS.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            className={`home-in ${cardClass}`}
            // A step per row, so both cards in a row rise together.
            style={{ "--i": Math.floor(i / 2) + 3 } as React.CSSProperties}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
