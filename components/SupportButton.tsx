"use client";

import { useState } from "react";
import { KOFI_URL } from "@/lib/site";
import { Modal } from "./Modal";

/**
 * The footer's "Donate" link: a short note on what tips pay for, with Ko-fi's
 * donation panel embedded below it so nobody has to leave the site. Ko-fi
 * handles one-off and monthly tips, cards, Apple Pay, Google Pay, and PayPal,
 * with no account needed to give.
 */
export function SupportButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`cursor-pointer ${className}`}
      >
        Donate
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Donate"
        tone="light"
      >
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          The Net Values was built by an NBA nerd, for NBA nerds. It&rsquo;s
          free to use, has no ads, and is run by one person. A donation helps
          cover the hosting and data costs that keep every player&rsquo;s Net
          Value current.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Give once or monthly, no account needed. Thank you!
        </p>
        {/* Mounted only while open: the modal's children render even when
            it's closed, and every page has this footer, so an always-mounted
            iframe would load Ko-fi (and its cookies) on every visit.
            allow="payment" lets Apple Pay and Google Pay run inside it. */}
        {open && (
          <div className="-mx-2 mt-2">
            <iframe
              src={`${KOFI_URL}/?hidefeed=true&widget=true&embed=true&preview=true`}
              title="Donate to The Net Values on Ko-fi"
              allow="payment"
              className="block h-150 w-full border-0 p-1"
            />
          </div>
        )}
        <p className="mt-1 text-center text-xs text-neutral-500">
          Trouble with the form?{" "}
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-900"
          >
            Donate on Ko-fi instead
          </a>
        </p>
      </Modal>
    </>
  );
}
