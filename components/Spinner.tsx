/**
 * The site's one loading indicator. A ring with a single accent arc, sized in
 * `em` so it scales with whatever text it sits beside.
 */
export function Spinner({
  className = "",
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block h-[1.25em] w-[1.25em] shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-accent ${className}`}
    />
  );
}
