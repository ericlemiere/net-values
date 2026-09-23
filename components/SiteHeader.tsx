"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/NavLinks";
import { SiteSearch } from "@/components/SiteSearch";
import { LogoWatermark } from "@/components/LogoWatermark";
import { MobileMenu } from "@/components/MobileMenu";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mediumSearchOpen, setMediumSearchOpen] = useState(false);
  const mediumSearchGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setMediumSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!mediumSearchOpen) return;
      const target = e.target as Node;
      const inGroup = mediumSearchGroupRef.current?.contains(target);
      if (!inGroup) setMediumSearchOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mediumSearchOpen]);

  return (
    <header className="site-header fixed inset-x-0 top-0 z-30 bg-background">
      <div className="site-header-backdrop" aria-hidden="true">
        <LogoWatermark />
      </div>

      {/* Large screens: one row with brand, links and search. */}
      <div className="relative z-1 hidden h-full w-full items-center gap-6 px-6 lg:flex">
        <Link
          href="/"
          className="shrink-0 rounded border-2 border-accent px-2 py-1 font-semibold text-white"
        >
          The Net Values
        </Link>
        <NavLinks />
        <SiteSearch className="ml-auto w-72" />
      </div>

      {/* Medium screens: search toggles open on the right in the same row. */}
      <div className="relative z-1 hidden h-full w-full items-center gap-6 px-6 md:flex lg:hidden">
        <Link
          href="/"
          className="shrink-0 rounded border-2 border-accent px-2 py-1 font-semibold text-white"
        >
          The Net Values
        </Link>
        <NavLinks className="flex-1 flex-wrap gap-x-4 gap-y-1" />
        <div className="ml-auto" />

        <div
          ref={mediumSearchGroupRef}
          className="fixed right-6 top-2 z-40 hidden items-center gap-2 md:flex lg:hidden"
        >
          <button
            type="button"
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/30 bg-background-box cursor-pointer text-white transition-colors duration-150 hover:border-accent"
            aria-expanded={mediumSearchOpen}
            aria-controls="medium-site-search"
            aria-label={mediumSearchOpen ? "Close search" : "Open search"}
            onClick={() => setMediumSearchOpen((open) => !open)}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`absolute h-5 w-5 transition-all duration-180 ease-out ${
                mediumSearchOpen
                  ? "scale-75 opacity-0"
                  : "scale-100 opacity-100"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`absolute h-5 w-5 transition-all duration-180 ease-out ${
                mediumSearchOpen
                  ? "scale-100 opacity-100"
                  : "scale-75 opacity-0"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>

          <div
            id="medium-site-search"
            aria-hidden={!mediumSearchOpen}
            className={`overflow-hidden transition-all duration-220 ease-out ${
              mediumSearchOpen
                ? "w-80 translate-x-0 opacity-100"
                : "pointer-events-none w-0 translate-x-2 opacity-0"
            }`}
          >
            <SiteSearch className="w-80" />
          </div>
        </div>
      </div>

      {/* Small screens: compact bar with a drawer for links + search. */}
      <div className="relative z-50 flex h-full w-full items-center gap-4 px-2 sm:px-6 md:hidden">
        <Link
          href="/"
          className="rounded border-2 border-accent px-2 py-1 font-semibold text-white"
        >
          The Net Values
        </Link>
        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/30 bg-white/5 text-white transition-colors hover:border-accent hover:bg-white/10"
          aria-expanded={menuOpen}
          aria-controls="mobile-site-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">Menu</span>
          <span className="relative h-4.5 w-5.5" aria-hidden="true">
            <span
              className={`absolute left-0 right-0 top-0 h-0.5 rounded bg-current transition-all duration-220 ease-out ${
                menuOpen ? "top-1/2 -translate-y-1/2 rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-current transition-all duration-180 ease-out ${
                menuOpen ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 right-0 bottom-0 h-0.5 rounded bg-current transition-all duration-220 ease-out ${
                menuOpen ? "top-1/2 -translate-y-1/2 -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

    </header>
  );
}
