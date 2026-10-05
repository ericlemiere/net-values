import { PAGE_COLUMN_PROSE } from "@/lib/layout";
import { CONTACT_EMAIL, pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Report a bug, flag a wrong salary or stat, or just say hello to The Net Values.",
  path: "/contact",
});

/** A mailto link that opens with the subject (and a starter body) filled in. */
function mailto(subject: string, body?: string) {
  const params = new URLSearchParams({ subject });
  if (body) params.set("body", body);
  // URLSearchParams writes spaces as "+", which mail clients show literally.
  return `mailto:${CONTACT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}

const REASONS = [
  {
    title: "Report a bug",
    text: "Something broken, missing, or looking wrong on the page. Say which page and what you saw; a screenshot helps.",
    action: "Report a bug",
    href: mailto(
      "Bug report",
      "Page (URL):\n\nWhat happened:\n\nWhat you expected:\n",
    ),
  },
  {
    title: "Data correction",
    text: "A salary, stat, or award that doesn't match the record. Name the player and season, and where you saw the right number if you can.",
    action: "Send a correction",
    href: mailto(
      "Data correction",
      "Player:\n\nSeason:\n\nWhat's wrong:\n\nSource for the right number:\n",
    ),
  },
  {
    title: "Everything else",
    text: "Questions about how Net Value works, ideas for the site, or anything else.",
    action: "Send an email",
    href: mailto("Hello"),
  },
];

export default function ContactPage() {
  return (
    <div className={PAGE_COLUMN_PROSE}>
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-3 max-w-prose text-white/70">
        The Net Values is a one-person project, and every message gets read.
        Pick whichever fits and your email will open with the details to fill
        in, or write straight to{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-accent underline-offset-2 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      <div className="mt-8 grid max-w-prose gap-4">
        {REASONS.map((r) => (
          <section
            key={r.title}
            className="rounded-md border border-white/15 bg-background-box/90 p-4 md:p-5"
          >
            <h2 className="text-lg font-semibold tracking-tight">{r.title}</h2>
            <p className="mt-1 text-white/70">{r.text}</p>
            <a
              href={r.href}
              className="mt-4 inline-block rounded-md border border-accent px-3 py-1.5 font-semibold transition-colors hover:bg-accent hover:text-black"
            >
              {r.action}
            </a>
          </section>
        ))}
      </div>
    </div>
  );
}
