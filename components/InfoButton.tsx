"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A small "?" that opens a modal explaining the figure beside it.
 *
 * Built on the native <dialog>: `showModal()` brings focus trapping, Escape to
 * close and the inert page behind it for free. A press on the backdrop closes
 * it too, and the page underneath is held still while it's open.
 */
export function InfoButton({
  title,
  children,
}: {
  /** The modal's heading, and what the button is labeled for screen readers. */
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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
      <dialog
        ref={dialogRef}
        aria-label={title}
        onClose={() => setOpen(false)}
        // A press on the backdrop is reported on the dialog element itself.
        // The panel fills the dialog, so any press whose target is the dialog
        // landed outside the panel.
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border-2 border-accent bg-background-box p-0 text-white backdrop:bg-black/70"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mt-1 -mr-1 cursor-pointer rounded px-2 py-1 text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
