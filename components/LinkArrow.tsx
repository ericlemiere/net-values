/**
 * The → that trails a link, nudged right while the link is hovered. The link
 * needs the `group` class. Inline-block so the transform applies, which also
 * keeps it out of the link's underline.
 */
export function LinkArrow() {
  return (
    <span
      aria-hidden="true"
      className="inline-block transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none"
    >
      &rarr;
    </span>
  );
}
