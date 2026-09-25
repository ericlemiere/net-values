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
    <li className="flex gap-3 sm:gap-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-accent font-mono text-sm font-semibold text-accent">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="mt-1 max-w-prose text-sm text-white/70">{children}</p>
        {working && <Working lines={working} className="mt-2" />}
      </div>
    </li>
  );
}

/** The arithmetic behind a figure, one calculation per line. */
export function Working({
  lines,
  className = "",
}: {
  /** A string, or several for a calculation too long to read on one line. */
  lines: ReactNode | string[];
  className?: string;
}) {
  return (
    <div
      className={`overflow-x-auto rounded-md border border-white/15 bg-background-box/90 px-3 py-2 font-mono text-xs text-accent sm:text-sm ${className}`}
    >
      {(Array.isArray(lines) ? lines : [lines]).map((line, i) => (
        /*
         * On a phone the arithmetic wraps rather than scrolling: a step is
         * read once, in place, and a line the reader has to drag sideways to
         * finish is worse than one that takes two rows. Past `sm` there's
         * room for the whole line, so it holds.
         */
        <p key={i} className="whitespace-normal sm:whitespace-nowrap">
          {line}
        </p>
      ))}
    </div>
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
    <div className="rounded-lg border border-white/15 bg-background-box/90 px-4 py-3">
      <dt className="font-mono text-sm font-semibold text-accent">{name}</dt>
      <dd className="mt-1 text-sm text-white/70">{children}</dd>
    </div>
  );
}

/**
 * A stacked fraction, typeset the way it would be on paper.
 *
 * A ÷ in running text sits too close in shape to a + to read at a glance, and
 * a slash turns a long denominator into a guessing game about precedence. A
 * bar settles both. `align-middle` puts the bar on the line's math axis rather
 * than dropping the numerator onto the baseline.
 */
export function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex flex-col items-center align-middle leading-tight">
      <span className="px-1 pb-0.5">{num}</span>
      <span className="w-full border-t border-current px-1 pt-0.5 text-center">
        {den}
      </span>
    </span>
  );
}

/**
 * One definition in a formula box: the equation, then a plain-language gloss
 * of it underneath for anyone who doesn't read the notation.
 */
export function Def({
  name,
  children,
  note,
}: {
  name: string;
  /** Left out for a raw input, which is defined by its note alone. */
  children?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-y-2">
        <span className="text-accent">
          <V>{name}</V>
        </span>
        {children && (
          <>
            <Op>=</Op>
            {children}
          </>
        )}
      </p>
      {note && (
        <p className="mt-1 max-w-prose font-sans text-xs text-white/50">
          {note}
        </p>
      )}
    </div>
  );
}

/** A named quantity in a formula, kept whole when the line wraps. */
export function V({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

/** An operator with the spacing print gives it, so terms don't run together. */
export function Op({ children }: { children: ReactNode }) {
  return <span className="mx-1.5">{children}</span>;
}
