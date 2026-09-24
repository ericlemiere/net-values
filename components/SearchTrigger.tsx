"use client";

/**
 * The magnifying-glass button that opens the search modal.
 *
 * It appears twice — once in the md-and-up row beside the last nav link, once
 * in the phone bar beside the menu button — so the two can never drift apart.
 */
export function SearchTrigger({
  className = "",
  onOpen,
}: {
  className?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search players or teams"
      aria-haspopup="dialog"
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/30 bg-white/5 text-white transition-colors hover:border-accent hover:bg-white/10 ${className}`.trim()}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
    </button>
  );
}
