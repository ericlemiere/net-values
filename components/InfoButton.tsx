"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";

/** A small "?" that opens a modal explaining the figure beside it. */
export function InfoButton({
  title,
  children,
}: {
  /** The modal's heading, and what the button is labeled for screen readers. */
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`What is ${title}?`}
        title={`What is ${title}?`}
        className="inline-flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/40 align-middle text-[0.625rem] font-semibold leading-none text-white/60 transition-colors hover:border-accent hover:text-accent"
      >
        ?
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Modal>
    </>
  );
}
