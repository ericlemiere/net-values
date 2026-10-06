/**
 * An option year, told apart by label and shape rather than color alone: a
 * player option is a solid chip (his call), a team option a dashed outline
 * (the team's call). bref colors the salary green or blue, which says nothing
 * to a reader who doesn't know the key or can't tell the two apart.
 */
export const OPTIONS = {
  player: {
    label: "Player option",
    short: "PO",
    className: "border-black bg-black text-white",
    title: "He can opt out before this season and become a free agent.",
  },
  team: {
    label: "Team option",
    short: "TO",
    className: "border-dashed border-black/60 text-black",
    title: "The team can decline this season and let him go.",
  },
} as const;

/**
 * `short` prints PO or TO, for a grid where a full label in every cell would
 * double the table's width; the shape and the hover still say which.
 */
export function OptionChip({
  option,
  short = false,
}: {
  option: keyof typeof OPTIONS;
  short?: boolean;
}) {
  const o = OPTIONS[option];
  return (
    <span
      className={`inline-flex shrink-0 cursor-help items-center rounded border px-1 py-px font-sans text-[12px] leading-none font-medium whitespace-nowrap ${o.className}`}
      title={short ? `${o.label}: ${o.title}` : o.title}
    >
      {short ? o.short : o.label}
    </span>
  );
}
