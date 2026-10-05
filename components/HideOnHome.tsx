"use client";

import { usePathname } from "next/navigation";

/**
 * Renders its children everywhere but the home page. For the bits of the
 * persistent layout (the footer, say) that the home page leaves out: the layout
 * is a server component and can't see the path itself.
 */
export function HideOnHome({ children }: { children: React.ReactNode }) {
  return usePathname() === "/" ? null : children;
}
