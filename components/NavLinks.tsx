"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** The site's primary destinations, in nav order. Shared with the mobile drawer
 *  so the two navs can never drift apart. */
export const NAV_LINKS = [
  { href: "/salaries", label: "Salaries" },
  { href: "/teams", label: "Teams" },
  // Advanced stats live behind the toggle on /stats rather than taking a nav
  // slot of their own; /advanced-stats redirects there.
  { href: "/stats", label: "Stats" },
  { href: "/seasons", label: "Seasons" },
  { href: "/mvp", label: "Awards" },
  { href: "/price-check", label: "Price Check" },
  { href: "/net-value", label: "Net Value" },
];

/**
 * Where the accent bar sits, in the nav's own coordinates.
 *
 * `slide` is what separates a move from an entrance: sliding in from a stale
 * position when the bar was hidden (on a player page, say, where no nav item
 * is active) would animate from somewhere the eye never saw it, so the bar
 * only transitions its geometry when it was already on screen.
 */
interface Bar {
  left: number;
  top: number;
  width: number;
  visible: boolean;
  slide: boolean;
}

export function NavLinks({
  className,
  linkClassName,
  onNavigate,
}: {
  className?: string;
  linkClassName?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<Bar | null>(null);

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) {
      setBar((prev) => (prev ? { ...prev, visible: false } : prev));
      return;
    }
    /*
     * The label's text rather than the link's box: in the drawer the links are
     * laid out in a column and stretch to its full width, and a bar as wide as
     * the drawer isn't an underline. Both rects come from the same place, so
     * the drawer's own transform cancels out of the subtraction.
     */
    const navBox = nav.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(active);
    const label = range.getBoundingClientRect();
    const box = label.width ? label : active.getBoundingClientRect();
    setBar((prev) => ({
      left: box.left - navBox.left,
      /* Two pixels of air under the label, matching underline-offset-4. */
      top: box.bottom - navBox.top + 2,
      width: box.width,
      visible: true,
      slide: Boolean(prev?.visible),
    }));
  }, []);

  useEffect(() => {
    measure();
    const nav = navRef.current;
    if (!nav) return;
    /*
     * The bar is measured, not styled, so anything that moves the labels has
     * to re-measure: the links wrap at the medium breakpoint, the drawer copy
     * is laid out in a column, and the webfont swapping in changes every
     * label's width.
     */
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    document.fonts?.ready.then(measure).catch(() => {});
    /*
     * A nav that's `display: none` at its breakpoint reports no resize when it
     * becomes visible again, so the observer alone would leave the copy that
     * just appeared holding a stale, zero-width bar. The window's own resize
     * fires either way.
     */
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, pathname]);

  return (
    <nav
      ref={navRef}
      className={`relative flex gap-4 text-sm ${className ?? ""}`.trim()}
    >
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={isActive}
            onClick={onNavigate}
            className={`${
              isActive
                ? /*
                   * Before hydration there is no measured bar, so the active
                   * link carries a plain text underline and the nav is never
                   * unmarked; the bar takes over the moment it has geometry.
                   */
                  `text-white ${
                    bar
                      ? ""
                      : "underline decoration-accent decoration-2 underline-offset-4"
                  }`
                : "text-zinc-400 hover:text-accent transition-colors"
            } ${linkClassName ?? ""}`.trim()}
          >
            {link.label}
          </Link>
        );
      })}

      {bar && (
        <span
          aria-hidden="true"
          className={`nav-underline${bar.slide ? " nav-underline-slide" : ""}`}
          style={{
            width: bar.width,
            opacity: bar.visible ? 1 : 0,
            transform: `translate3d(${bar.left}px, ${bar.top}px, 0)`,
          }}
        />
      )}
    </nav>
  );
}
