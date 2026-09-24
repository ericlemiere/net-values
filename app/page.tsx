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

const cardClass =
  "whitespace-nowrap rounded-md border border-accent bg-background-box/90 px-2 md:px-4 py-1.5 md:py-2 transition-colors hover:border-accent hover:bg-accent hover:text-black";

export default function Home() {
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
      className="home-intro home-intro-wait flex flex-1 flex-col md:items-center md:justify-center p-6 md:text-center"
    >
      <img
        src="/tnv-transparent.png"
        alt="The Net Values Logo"
        className="home-in hidden md:block mb-4 w-[50vw] max-w-80"
        style={{ "--i": 0 } as React.CSSProperties}
      />
      <h1
        className="home-in mb-3 text-4xl font-semibold tracking-tight"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        The Net Values
      </h1>
      <p
        className="home-in text-white/80 mb-4 md:mb-8 max-w-md"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        A way to evaluate an NBA player&apos;s Net Value based on their
        production on the court and salary.
      </p>
      <nav className="flex flex-col gap-3 md:hidden">
        {NAV_LINKS.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            className={`home-in ${cardClass}`}
            style={{ "--i": i + 3 } as React.CSSProperties}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <img
        src="/tnv-transparent.png"
        alt="The Net Values Logo"
        className="home-in block absolute bottom-0 left-4 md:hidden mb-4 w-40"
        style={{ "--i": NAV_LINKS.length + 3 } as React.CSSProperties}
      />
    </div>
  );
}
