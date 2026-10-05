import Link from "next/link";
import { PAGE_COLUMN_PROSE } from "@/lib/layout";
import { CONTACT_EMAIL, pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Privacy",
  description:
    "What The Net Values collects when you visit (anonymous usage stats via Google Analytics) and what it doesn't.",
  path: "/privacy",
});

const HEADING = "mt-8 text-xl font-semibold tracking-tight";
const BODY = "mt-2 max-w-prose text-white/70";
const LINK = "text-accent underline-offset-2 hover:underline";

export default function PrivacyPage() {
  return (
    <div className={PAGE_COLUMN_PROSE}>
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-3 max-w-prose text-white/70">
        The short version: there are no accounts, nothing to sign up for, and
        nothing about you is sold. The only thing collected is anonymous
        information about how the site gets used.
      </p>

      <h2 className={HEADING}>Google Analytics</h2>
      <p className={BODY}>
        The site uses Google Analytics to count visits and see which pages
        people use. It sets cookies in your browser and records things like the
        pages you view, how you arrived, your browser and device type, and an
        approximate location derived from your IP address. None of that is tied
        to your name, and it&rsquo;s only looked at in aggregate.
      </p>
      <p className={BODY}>
        Google processes this data under its own{" "}
        <a
          href="https://policies.google.com/privacy"
          className={LINK}
          target="_blank"
          rel="noopener noreferrer"
        >
          privacy policy
        </a>
        . You can opt out on every site with Google&rsquo;s{" "}
        <a
          href="https://tools.google.com/dlpage/gaoptout"
          className={LINK}
          target="_blank"
          rel="noopener noreferrer"
        >
          opt-out browser add-on
        </a>
        , or by blocking cookies or trackers in your browser; the site works the
        same either way.
      </p>

      <h2 className={HEADING}>Email</h2>
      <p className={BODY}>
        If you write in through the{" "}
        <Link href="/contact" className={LINK}>
          contact page
        </Link>
        , your email address and message are used only to reply to you.
      </p>

      <h2 className={HEADING}>Questions</h2>
      <p className={BODY}>
        Ask at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      <p className="mt-8 text-sm text-white/40">Last updated October 5, 2026</p>
    </div>
  );
}
