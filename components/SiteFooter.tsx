import Image from "next/image";
import Link from "next/link";
import { HideOnHome } from "@/components/HideOnHome";
import { getDataUpdatedAt } from "@/lib/db/queries";
import { SITE_NAME } from "@/lib/site";

const linkClass = "text-white/70 transition-colors hover:text-accent";

/**
 * "Oct 5, 2026", on Eastern time — the NBA's clock, and the one the morning
 * job's "yesterday's games" means.
 */
function formatUpdated(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

/**
 * The logo bottom-left, where the home page always had it, with the site's
 * housekeeping beside it: contact, privacy, where the numbers come from and
 * how fresh they are. The header nav stays out of it on purpose.
 *
 * The layout's body is a flex column with `main` taking up the slack, so on a
 * page shorter than the screen (the home page) this sits on the bottom edge,
 * and on a longer one it follows the content.
 */
export async function SiteFooter() {
  const updatedAt = await getDataUpdatedAt();

  return (
    <footer className="relative z-10 flex items-end gap-4 px-4 pb-4 pt-6 md:gap-6">
      {/* A pre-sized copy (640px, 2x the largest display) served as-is:
          Vercel's image optimizer answers 402 once the plan's quota runs out,
          which left the logo blank, so it doesn't go through /_next/image. */}
      <Link href="/" aria-label={`${SITE_NAME} home`} className="shrink-0">
        <Image
          src="/tnv-transparent-640.png"
          alt="The Net Values Logo"
          width={640}
          height={640}
          unoptimized
          // Eager: on the home page it sits above the fold and is the largest
          // paint. Elsewhere it's below the fold, but it's one cached 27KB file
          // shared by every page, so fetching it up front costs next to nothing.
          loading="eager"
          // Full size only where there is height to spare, so it never pushes
          // the home page into scrolling on a laptop screen.
          className="h-28 w-auto md:h-32 md:[@media(min-height:880px)]:h-40"
        />
      </Link>
      <div className="flex min-w-0 flex-col items-start gap-1.5 pb-2 text-xs text-white/50 md:text-sm">
        <nav className="mb-1 flex gap-4 text-sm font-semibold md:text-base">
          <Link href="/contact" className={linkClass}>
            Contact
          </Link>
          <Link href="/privacy" className={linkClass}>
            Privacy
          </Link>
        </nav>
        {/* Two dotted lines on a wide screen. On a phone, beside the logo, the
            dots drop out and each phrase takes its own line, so nothing breaks
            mid-name. The home page drops the data credit and keeps the date. */}
        <p>
          <HideOnHome>
            <span className="block whitespace-nowrap md:inline">
              Data via NBA.com,
            </span>{" "}
            <span className="block whitespace-nowrap md:inline">
              Basketball-Reference, and HoopsHype
            </span>
            {updatedAt && <span className="hidden md:inline"> &middot; </span>}
          </HideOnHome>
          {updatedAt && (
            <>
              <span className="block whitespace-nowrap md:inline">
                Updated {formatUpdated(updatedAt)}
              </span>
            </>
          )}
        </p>
        <p>
          <span className="block whitespace-nowrap md:inline">
            &copy; {new Date().getFullYear()} {SITE_NAME}
          </span>
          <span className="hidden md:inline"> &middot; </span>
          <span className="block whitespace-nowrap md:inline">
            Not affiliated with the NBA
          </span>
        </p>
      </div>
    </footer>
  );
}
