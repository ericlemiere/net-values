import Link from "next/link";
import { PAGE_COLUMN_PROSE } from "@/lib/layout";
import { CONTACT_EMAIL, pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Privacy",
  description:
    "What The Net Values collects when you visit (anonymous usage stats via Google Analytics) or donate (through Ko-fi), and what it doesn't.",
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
        nothing about you is sold. Browsing the site only collects anonymous
        information about how it gets used. If you donate, Ko-fi handles the
        payment and shares a few details with me, covered below.
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

      <h2 className={HEADING}>Donations</h2>
      <p className={BODY}>
        The Donate form in the footer is provided by Ko-fi and loads from
        Ko-fi&rsquo;s servers only when you open it. Ko-fi may set its own
        cookies at that point. Payments are processed by Ko-fi&rsquo;s payment
        partners (Stripe or PayPal), and your card or bank details never reach
        this site or me.
      </p>
      <p className={BODY}>
        When you donate, Ko-fi shares the amount, your email address, and the
        name and message you enter, if any. They&rsquo;re used only to keep
        track of donations and to thank you, and are never sold or shared. Ko-fi
        handles everything else under its own{" "}
        <a
          href="https://more.ko-fi.com/privacy"
          className={LINK}
          target="_blank"
          rel="noopener noreferrer"
        >
          privacy policy
        </a>
        .
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
      <p className="mt-8 text-sm text-white/40">
        Last updated November 3, 2026
      </p>
    </div>
  );
}
