"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/components/NavLinks";
import { SiteSearch } from "@/components/SiteSearch";

/**
 * The small-screen navigation drawer.
 *
 * It renders inside the header so it inherits the header's stacking context
 * and lands above the page without competing with it for z-index, but both
 * panel and scrim are `position: fixed` and start below the header bar, which
 * keeps the bar — and the close button in it — untouched while the drawer is
 * open. Everything about how it moves lives in globals.css under
 * `.mobile-menu`; this file only decides when it is open and what's in it.
 */
export function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  // The page behind the scrim must not scroll under it, and Escape closes.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      <div
        className={`mobile-menu-scrim${open ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        id="mobile-site-menu"
        aria-hidden={!open}
        className={`mobile-menu${open ? " is-open" : ""}`}
      >
        <div className="mobile-menu-item" style={{ "--i": 0 } as React.CSSProperties}>
          <SiteSearch
            className="w-full"
            inputClassName="px-4 py-3 rounded-lg"
          />
        </div>

        <nav className="mt-6 flex flex-col" aria-label="Site">
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              aria-current={pathname === link.href ? "page" : undefined}
              className="mobile-menu-link mobile-menu-item"
              style={{ "--i": i + 1 } as React.CSSProperties}
            >
              <span>{link.label}</span>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="mobile-menu-chevron"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </nav>

        <p
          className="mobile-menu-item mt-auto pt-8 text-sm leading-relaxed text-white/40"
          style={{ "--i": NAV_LINKS.length + 1 } as React.CSSProperties}
        >
          Evaluating an NBA player&rsquo;s value against what they&rsquo;re paid.
        </p>
      </div>
    </>
  );
}
