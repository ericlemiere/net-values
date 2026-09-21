"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/salaries", label: "Salaries" },
  { href: "/teams", label: "Teams" },
  { href: "/stats", label: "Stats" },
  { href: "/advanced-stats", label: "Advanced Stats" },
  { href: "/net-value", label: "Net Value" },
];

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

  return (
    <nav className={`flex gap-4 text-sm ${className ?? ""}`.trim()}>
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`${
              isActive
                ? "text-white underline decoration-accent decoration-2 underline-offset-4"
                : "text-zinc-400 hover:text-accent transition-colors"
            } ${linkClassName ?? ""}`.trim()}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
