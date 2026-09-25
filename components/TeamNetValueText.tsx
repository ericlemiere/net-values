/**
 * What Team Net Value means. One copy, shown both in the explainer's Team Net
 * Value section and in the help modal beside the figure on the Teams pages, so
 * the two can't drift apart.
 */
export function TeamNetValueText({
  className = "mt-3 max-w-prose text-sm text-white/70",
}: {
  className?: string;
}) {
  return (
    <>
      <p className={className}>
        A team&rsquo;s Net Value is its players&rsquo; Net Values added up: how
        many NVPs the roster returned above what it cost. It counts only players
        on a full contract, meaning a salary of at least 0.5% of that
        season&rsquo;s cap. That leaves out two-way deals and short-term
        signings while keeping a standard 15-man roster in every era.
      </p>
      <p className={className}>
        It is a sum rather than an average on purpose. A team carrying extra
        bodies through injuries would see an average dragged toward its
        fill-ins, while the sum says plainly what the whole roster returned.
        Compared with real results, team Net Value correlates with actual wins
        at r = 0.77.
      </p>
    </>
  );
}
