"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/NavLinks";
import { LogoWatermark } from "@/components/LogoWatermark";
import { MobileMenu } from "@/components/MobileMenu";
import { SearchModal } from "@/components/SearchModal";
import { SearchTrigger } from "@/components/SearchTrigger";

/** How long the modal's exit animation runs; see `.search-modal.is-closing`. */
const SEARCH_EXIT_MS = 160;

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  /* Three states rather than a boolean, because the modal has to stay mounted
     long enough to animate itself out. */
  const [search, setSearch] = useState<"closed" | "open" | "closing">("closed");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMenuOpen(false);
    setSearch("closed");
  }, [pathname]);

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    [],
  );

  const openSearch = useCallback(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    /*
     * flushSync is what gets the keyboard up on iOS: Safari only opens it for a
     * focus() that happens inside the gesture that asked for it, so the modal
     * has to be in the DOM before this handler returns rather than after
     * React's next render.
     */
    flushSync(() => {
      setMenuOpen(false);
      setSearch("open");
    });
    searchInputRef.current?.focus();
  }, []);

  const closeSearch = useCallback(() => {
    setSearch((state) => (state === "open" ? "closing" : state));
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => setSearch("closed"), SEARCH_EXIT_MS);
  }, []);

  return (
    <header className="site-header fixed inset-x-0 top-0 z-30 bg-background">
      <div className="site-header-backdrop" aria-hidden="true">
        <LogoWatermark />
      </div>

      {/* Medium and up: brand, links, and the search button beside the last link. */}
      <div className="relative z-1 hidden h-full w-full items-center gap-6 px-6 md:flex">
        <Link
          href="/"
          className="shrink-0 rounded border-2 border-accent px-2 py-1 font-semibold text-white"
        >
          The Net Values
        </Link>
        <NavLinks className="flex-wrap gap-x-4 gap-y-1" />
        <SearchTrigger className="h-9 w-9" onOpen={openSearch} />
      </div>

      {/* Small screens: compact bar with a drawer for the links. */}
      <div className="relative z-50 flex h-full w-full items-center gap-2 px-2 sm:px-6 md:hidden">
        <Link
          href="/"
          className="rounded border-2 border-accent px-2 py-1 font-semibold text-white"
        >
          The Net Values
        </Link>
        <SearchTrigger className="ml-auto h-10 w-10" onOpen={openSearch} />
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/30 bg-white/5 text-white transition-colors hover:border-accent hover:bg-white/10"
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

      {search !== "closed" && (
        <SearchModal
          closing={search === "closing"}
          onClose={closeSearch}
          inputRef={searchInputRef}
        />
      )}
    </header>
  );
}
