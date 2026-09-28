"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The site's small explanatory modal, shared by InfoButton and GlossaryButton.
 * One can open over another: `showModal()` stacks them in the top layer, and
 * Escape or a backdrop press closes only the one on top.
 *
 * Built on the native <dialog>: `showModal()` brings focus trapping, Escape to
 * close and the inert page behind it for free. A press on the backdrop closes
 * it too, and the page underneath is held still while it's open.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The modal's heading, and its accessible name. */
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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
    <dialog
      ref={dialogRef}
      aria-label={title}
      // Only this dialog's own close. A modal opened from inside this one (the
      // glossary's "?" does that) sits inside it in the React tree, and React
      // passes its close up to here too, which would shut both.
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // A press on the backdrop is reported on the dialog element itself.
      // The panel fills the dialog, so any press whose target is the dialog
      // landed outside the panel.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // text-left: the dialog can be rendered inside an aligned table cell or
      // header, and would otherwise inherit its alignment.
      className="modal-dialog m-auto text-left max-h-[calc(100dvh-4rem)] overflow-y-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border-2 border-accent bg-background-box p-0 text-white backdrop:bg-black/70"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 cursor-pointer rounded px-2 py-1 text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
