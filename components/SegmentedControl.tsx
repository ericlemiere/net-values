"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/** Where the highlight sits, in the group's own coordinates. */
interface Thumb {
  left: number;
  width: number;
  /** Only a highlight already on screen slides; the first one just appears. */
  slide: boolean;
}

const SIZES = {
  /** Beside a heading, as on the /net-value explainer. */
  sm: {
    group: "rounded-lg",
    button: "rounded-md px-2.5 py-0.5",
    thumb: "rounded-md",
  },
  /** In a form, the height of the season dropdown's button beside it. */
  md: {
    group: "rounded-md",
    button: "rounded px-2.5 py-1",
    thumb: "rounded",
  },
};

/**
 * A row of mutually exclusive options under one thin accent outline, the one
 * that's on filled in. The fill is a single highlight behind the buttons that
 * slides to whichever is picked.
 *
 * The highlight is measured rather than styled, since the segments size to
 * their labels. Until it has a measurement (on the server, and before
 * hydration) the picked button fills itself, so the choice is never unmarked;
 * the highlight takes over once it has geometry.
 *
 * `fill` stretches the control to its container and splits it into equal
 * segments.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "sm",
  fill = false,
}: {
  options: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers: what is being chosen. */
  label: string;
  size?: keyof typeof SIZES;
  fill?: boolean;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const styles = SIZES[size];

  const measure = useCallback(() => {
    const group = groupRef.current;
    const active = group?.querySelector<HTMLElement>('[aria-pressed="true"]');
    // A control inside something `hidden` has no box to measure; it keeps its
    // last highlight until it's shown and measured again.
    if (!group || !active || active.offsetWidth === 0) return;
    setThumb((prev) => ({
      left: active.offsetLeft,
      width: active.offsetWidth,
      slide: prev !== null,
    }));
  }, []);

  useEffect(() => {
    measure();
  }, [measure, value]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    // Anything that resizes the segments moves the highlight: a filled
    // control's container resizing, or the webfont swapping in.
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={label}
      className={`relative flex items-center gap-0.5 border border-accent bg-background p-0.5 ${styles.group} ${
        fill ? "w-full" : "w-fit"
      }`}
    >
      {thumb && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0.5 left-0 bg-accent ${styles.thumb} ${
            thumb.slide
              ? "transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
              : ""
          }`}
          style={{
            width: thumb.width,
            transform: `translateX(${thumb.left}px)`,
          }}
        />
      )}
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={`relative cursor-pointer text-xs font-medium transition-colors ${styles.button} ${
              fill ? "flex-1 text-center" : ""
            } ${
              on
                ? `text-accent-foreground ${thumb ? "" : "bg-accent"}`
                : "text-white/60 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
