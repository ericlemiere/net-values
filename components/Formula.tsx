import type { ReactNode } from "react";

/** A step in the worked example: the arithmetic, then what it means. */
export function Step({
  n,
  title,
  children,
  working,
}: {
  n: number;
  title: string;
  children: ReactNode;
  /** A string, or several for a calculation too long to read on one line. */
  working?: ReactNode | string[];
}) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-accent font-mono text-sm font-semibold text-accent">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="mt-1 max-w-prose text-sm text-white/70">{children}</p>
        {working && (
          <div className="mt-2 overflow-x-auto rounded-md border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-accent">
            {(Array.isArray(working) ? working : [working]).map((line, i) => (
              <p key={i} className="whitespace-nowrap">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** A short definition of a term used in the formula. */
export function Term({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/5 px-4 py-3">
      <dt className="font-mono text-sm font-semibold text-accent">{name}</dt>
      <dd className="mt-1 text-sm text-white/70">{children}</dd>
    </div>
  );
}
