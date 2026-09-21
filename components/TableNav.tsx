"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useTransition,
  type ReactNode,
} from "react";
import { Spinner } from "./Spinner";

/**
 * One pending state shared by everything that re-queries a table: the season
 * and team filters, the Averages/Totals toggle, the sortable column headers
 * and the pager.
 *
 * They all change search params on the SAME route, which `loading.tsx` does
 * not cover — React keeps the current UI mounted and marks the navigation
 * pending rather than unmounting to a Suspense fallback. Routing every one of
 * them through a single `useTransition` is what makes that pending state
 * observable, so the table can say it's working.
 */
interface TableNavValue {
  pending: boolean;
  navigate: (href: string) => void;
}

const TableNavContext = createContext<TableNavValue>({
  pending: false,
  navigate: () => {},
});

export function useTableNav() {
  return useContext(TableNavContext);
}

export function TableNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href)),
    [router]
  );
  return (
    <TableNavContext.Provider value={{ pending, navigate }}>
      {children}
    </TableNavContext.Provider>
  );
}

/**
 * A Link that goes through the shared transition. It keeps the real href, so
 * prefetching, middle-click and "open in new tab" all still behave — only a
 * plain left-click is intercepted.
 */
export function NavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { navigate } = useTableNav();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </Link>
  );
}

/** Dims its table and floats a spinner over it while a re-query is in flight. */
export function TableOverlay({ children }: { children: ReactNode }) {
  const { pending } = useTableNav();
  return (
    <div className="relative" aria-busy={pending}>
      <div
        className={`transition-opacity duration-150 ${pending ? "opacity-40" : ""}`}
      >
        {children}
      </div>
      {pending && (
        // Covers the table so a second click can't queue another query.
        <div className="absolute inset-0 grid place-items-start justify-center pt-24">
          <span className="sticky top-1/2 flex items-center gap-3 rounded-lg border-2 border-accent bg-black/90 px-4 py-2 text-sm text-white">
            <Spinner />
            Loading
          </span>
        </div>
      )}
    </div>
  );
}
