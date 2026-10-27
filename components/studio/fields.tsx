"use client";

/**
 * The Studio's control primitives. Every one wraps a native input (range,
 * radio, checkbox, select), so keyboard, screen readers and form semantics
 * come for free; the terminal look is drawn on top.
 */

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { eighthsBar } from "@/lib/ascii/charsets";
import { cn } from "@/lib/utils";

/** A titled group of controls, ruled like a terminal section header. */
export const Section = ({
  title,
  action,
  children,
  className,
}: {
  title: string;
  /** A small control on the header's trailing edge. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("px-3 py-3", className)}>
      <div className="mb-2.5 flex h-5 items-center gap-2">
        <h3 id={id} className="label-caps text-muted-foreground shrink-0">
          {title}
        </h3>
        <span aria-hidden="true" className="bg-rule h-px flex-1" />
        {action}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
};

const formatValue = (value: number, step: number) => {
  if (step >= 1) {
    return value.toFixed(0);
  }
  return value.toFixed(step >= 0.1 ? 1 : 2);
};

/**
 * How many glyphs of the element's font fit across it, kept current as it
 * resizes, so a glyph bar always fills its track exactly.
 */
const useGlyphColumns = () => {
  const ref = useRef<HTMLSpanElement>(null);
  const [columns, setColumns] = useState(32);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const probe = document.createElement("span");
    probe.textContent = "█".repeat(10);
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    element.append(probe);
    const advance = probe.getBoundingClientRect().width / 10;
    probe.remove();
    const measure = () => {
      const { width } = element.getBoundingClientRect();
      if (advance > 0) {
        setColumns(Math.max(4, Math.floor(width / advance)));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, columns] as const;
};

/**
 * A range input drawn as a bar of eighth-block glyphs. The native input
 * sits on top, invisible, so dragging, arrow keys and Home/End all work.
 */
export const GlyphSlider = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "",
  disabled = false,
  format,
  compact = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  unit?: string;
  disabled?: boolean;
  format?: (value: number) => string;
  /** One row: the label is for screen readers, the value sits after the bar. */
  compact?: boolean;
}) => {
  const id = useId();
  const [barRef, barColumns] = useGlyphColumns();
  const share = max > min ? (value - min) / (max - min) : 0;
  const shown = format ? format(value) : `${formatValue(value, step)}${unit}`;
  return (
    <div
      className={cn(
        compact
          ? "grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2"
          : "grid gap-1",
        disabled && "opacity-45"
      )}
    >
      <div
        className={cn(
          "flex items-baseline justify-between gap-2 text-xs",
          compact && "sr-only"
        )}
      >
        <label htmlFor={id} className="text-foreground/80">
          {label}
        </label>
        {compact ? null : (
          <output htmlFor={id} className="text-foreground tabular text-[11px]">
            {shown}
          </output>
        )}
      </div>
      <div className="has-[:focus-visible]:outline-ring relative h-5 min-w-0 rounded-[2px] outline-offset-2 has-[:focus-visible]:outline-2">
        <div
          aria-hidden="true"
          className="border-rule bg-muted/40 flex h-full items-center overflow-hidden rounded-[2px] border px-1"
        >
          <span
            ref={barRef}
            className="text-foreground/85 relative block w-full overflow-hidden text-[11px] leading-none whitespace-pre"
          >
            {eighthsBar(share, barColumns)}
          </span>
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0 disabled:cursor-not-allowed"
        />
      </div>
      {compact ? (
        <output
          htmlFor={id}
          className="text-foreground tabular text-end text-[11px]"
        >
          {shown}
        </output>
      ) : null}
    </div>
  );
};

export interface SegmentOption<Value extends string> {
  readonly value: Value;
  readonly label: ReactNode;
  /** Accessible name when `label` is not plain text. */
  readonly title?: string;
}

/**
 * One choice from a few, as native radios: arrow keys move the choice,
 * Tab leaves the group.
 */
export const Segmented = <Value extends string>({
  label,
  value,
  options,
  onChange,
  columns,
  hideLabel = false,
}: {
  label: string;
  value: Value;
  options: readonly SegmentOption<Value>[];
  onChange: (value: Value) => void;
  /** Lay options out in a grid of this many columns instead of one row. */
  columns?: number;
  hideLabel?: boolean;
}) => {
  const name = useId();
  return (
    <fieldset className="grid min-w-0 gap-1">
      <legend
        className={cn(
          "text-foreground/80 mb-1 text-xs",
          hideLabel && "sr-only"
        )}
      >
        {label}
      </legend>
      {/* Wrapping flex rather than a grid, so a short last row stretches
          instead of leaving an empty cell. */}
      <div className="border-rule bg-rule flex flex-wrap gap-px overflow-hidden rounded-[3px] border">
        {options.map((option) => (
          <label
            key={option.value}
            title={option.title}
            style={{
              flexBasis: `calc(${100 / (columns ?? options.length)}% - 1px)`,
            }}
            className={cn(
              "min-w-0 grow",
              "bg-background text-foreground/75 hover:text-foreground relative flex h-7 cursor-pointer items-center justify-center px-1.5 text-[11px] whitespace-nowrap transition-colors duration-100 select-none",
              "has-[:checked]:bg-foreground has-[:checked]:text-background",
              "has-[:focus-visible]:outline-ring has-[:focus-visible]:z-10 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              aria-label={option.title}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

/** A checkbox drawn as `[x]`. */
export const Toggle = ({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) => (
  <label className="group/toggle has-[:focus-visible]:outline-ring flex cursor-pointer items-center gap-2 rounded-[2px] py-0.5 text-xs outline-offset-2 select-none has-[:focus-visible]:outline-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
      className="sr-only"
    />
    <span
      aria-hidden="true"
      className={cn(
        "text-[11px] tabular-nums",
        checked ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {checked ? "[■]" : "[ ]"}
    </span>
    <span className="text-foreground/80 group-hover/toggle:text-foreground">
      {label}
    </span>
    {hint ? (
      <span className="text-muted-foreground ms-auto text-[11px]">{hint}</span>
    ) : null}
  </label>
);

/** A small bordered text button in the panel style. */
export const PanelButton = ({
  children,
  active = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) => (
  <button
    type="button"
    aria-pressed={active}
    className={cn(
      "focus-visible:outline-ring border-rule inline-flex h-7 items-center justify-center gap-1.5 rounded-[3px] border px-2 text-[11px] whitespace-nowrap transition-[background-color,color,scale] duration-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5 [&_svg]:shrink-0",
      active
        ? "bg-foreground text-background border-foreground"
        : "bg-background text-foreground/80 hover:text-foreground hover:bg-muted/60",
      className
    )}
    {...props}
  >
    {children}
  </button>
);
