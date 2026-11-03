import Image from "next/image";

/**
 * The Larry O'Brien Trophy, marking a championship season.
 *
 * A pre-sized copy (64px tall, 2x the largest display, the 32px champion
 * banner on the seasons page) served as-is, like the footer logo: Vercel's
 * image optimizer answers 402 once the plan's quota runs out.
 *
 * Height comes from `className`; the width follows the image's shape. With a
 * `label` it's announced and gets a tooltip; without one it's decorative,
 * for where the text beside it already says "champions".
 */
export function ChampionTrophy({
  className = "h-[1.125rem]",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Image
      src="/nba_finals_trophy.png"
      alt={label ?? ""}
      title={label}
      width={37}
      height={64}
      unoptimized
      className={`w-auto shrink-0 ${className}`}
    />
  );
}
