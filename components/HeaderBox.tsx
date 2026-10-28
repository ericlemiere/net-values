/** One figure in the header strip: a label, the number, and a caption. */
export function HeaderBox({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="w-full rounded-lg border-2 border-accent bg-background-box px-3 py-2 md:w-auto md:whitespace-nowrap md:px-4 md:text-right">
      <div className="flex items-center md:items-start justify-between gap-3 md:block">
        <div className="text-sm text-white/60">
          {label}
          <div className="text-xs text-white/40 md:hidden">{caption}</div>
        </div>
        <div className="shrink-0 text-right font-mono text-lg font-semibold tabular-nums text-accent md:text-2xl">
          {value}
        </div>
      </div>
      {/* Reserved even when empty so boxes beside each other stay level. */}
      <div className="hidden min-h-4 text-xs text-white/40 md:block">
        {caption}
      </div>
    </div>
  );
}
