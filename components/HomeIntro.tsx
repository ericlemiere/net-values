"use client";

import Image from "next/image";
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
      className="home-intro home-intro-wait flex flex-1 flex-col p-6 md:mt-12"
    >
      {/* A pre-sized copy (640px, 2x the largest display) served as-is:
          Vercel's image optimizer answers 402 once the plan's quota runs out,
          which left the logo blank, so it doesn't go through /_next/image. */}
      {/* <Image
        src="/tnv-transparent-640.png"
        alt="The Net Values Logo"
        width={640}
        height={640}
        unoptimized
        fetchPriority="high"
        className="home-in hidden md:block mb-4 h-auto w-[50vw] max-w-80"
        style={{ "--i": 0 } as React.CSSProperties}
      /> */}
      <h1
        className="home-in mb-3 text-4xl md:text-6xl font-semibold tracking-tight"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        The Net Values
      </h1>
      <p
        className="home-in text-white/80 mb-4 md:mb-8 max-w-xl"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        A way to evaluate an NBA player&apos;s Net Value based on their
        production on the court and salary.
      </p>
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
      {/* In flow rather than pinned to the bottom, so it can never land on the
          nav. The slot grows into whatever height the screen has left under
          the links (up to 10rem of logo, `mt-auto` keeping it at the foot of
          a tall screen) and shrinks to a 5rem floor on a short one, and the
          logo is sized off the slot, so it fits the screen instead of making
          the page scroll to reach it. */}
      <div className="relative mt-auto -mb-2 -ml-2 min-h-24 max-h-44 flex-1">
        <Image
          src="/tnv-transparent-640.png"
          alt="The Net Values Logo"
          width={640}
          height={640}
          unoptimized
          className="home-in absolute bottom-0 left-0 h-[calc(100%-1rem)] w-auto"
          style={
            {
              "--i": Math.ceil(HOME_LINKS.length / 2) + 3,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}
