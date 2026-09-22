"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/NavLinks";
import { SiteSearch } from "@/components/SiteSearch";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="site-header fixed inset-x-0 top-0 z-30 bg-background">
      <div className="site-header-backdrop" aria-hidden="true">
        <div className="logo-watermark" />
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

      {/* Medium screens: search sits below the nav links. */}
      <div className="relative z-1 hidden h-full w-full px-6 py-2 md:block lg:hidden">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="shrink-0 rounded border-2 border-accent px-2 py-1 font-semibold text-white"
          >
            The Net Values
          </Link>
          <NavLinks className="flex-1 flex-wrap gap-x-4 gap-y-1" />
        </div>
        <SiteSearch className="mt-2 w-full" />
      </div>

      {/* Small screens: compact bar with a drawer for links + search. */}
      <div className="relative z-1 flex h-full w-full items-center gap-4 px-4 sm:px-6 md:hidden">
        <Link
          href="/"
          className="rounded border-2 border-accent px-2 py-1 font-semibold text-white"
        >
          The Net Values
        </Link>
        <button
          type="button"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded border border-white/30 bg-white/5 text-white transition-colors hover:bg-white/10"
          aria-expanded={menuOpen}
          aria-controls="mobile-site-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">Menu</span>
          <span className="relative h-5 w-5" aria-hidden="true">
            <span
              className={`absolute left-0 right-0 h-0.5 rounded bg-current transition-all duration-220 ease-out ${
                menuOpen ? "top-2.5 rotate-45" : "top-1"
              }`}
            />
            <span
              className={`absolute left-0 right-0 top-2.5 h-0.5 rounded bg-current transition-all duration-180 ease-out ${
                menuOpen ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 right-0 h-0.5 rounded bg-current transition-all duration-220 ease-out ${
                menuOpen ? "top-2.5 -rotate-45" : "top-4"
              }`}
            />
          </span>
        </button>
      </div>

      <div
        id="mobile-site-menu"
        aria-hidden={!menuOpen}
        className={`absolute inset-x-0 top-full z-40 border-t border-white/15 bg-background-box px-4 py-4 shadow-xl shadow-black/50 transform-gpu transition-all duration-320 ease-out will-change-transform motion-reduce:transition-none md:hidden ${
          menuOpen
            ? "translate-x-0"
            : "pointer-events-none translate-x-[105%]"
        }`}
      >
        <NavLinks
          className="flex-col gap-3"
          linkClassName="text-base"
          onNavigate={() => setMenuOpen(false)}
        />
        <SiteSearch className="mt-4 w-full" />
      </div>
    </header>
  );
}
