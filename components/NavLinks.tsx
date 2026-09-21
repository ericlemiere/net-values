"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/stats", label: "Stats" },
  { href: "/advanced-stats", label: "Advanced Stats" },
  { href: "/salaries", label: "Salaries" },
  { href: "/teams", label: "Teams" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 text-sm">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive
                ? "text-white underline decoration-accent decoration-2 underline-offset-4"
                : "text-zinc-400 hover:text-accent transition-colors"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
