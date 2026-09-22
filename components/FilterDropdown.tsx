"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

interface DropdownOption {
  value: string;
  label: string;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative flex w-full items-center justify-between gap-2 rounded-md bg-background-box p-2 text-sm text-white md:w-auto ${
        className ?? ""
      }`.trim()}
    >
      <span className="text-white/70">{label}</span>
      <button
        id={buttonId}
        type="button"
        className="inline-flex min-w-35 items-center justify-between gap-3 rounded-md border border-white/20 bg-white/5 px-2.5 py-1 text-left text-white transition-colors hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-4 w-4 text-white/60 transform-gpu transition-transform duration-200 ease-out motion-reduce:transition-none ${
            open ? "rotate-180" : "rotate-0"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 7.5L10 12.5L15 7.5" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute right-2 top-[calc(100%-2px)] z-30 mt-2 max-h-72 min-w-42 overflow-y-auto rounded-md border border-white/20 bg-background-box py-1 shadow-xl shadow-black/50"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`w-full whitespace-nowrap px-3 py-1.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-accent text-black"
                      : "text-white hover:bg-white/10"
                  }`}
                  onClick={() => {
                    setOpen(false);
                    if (!active) onChange(option.value);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
