"use client";

/**
 * Segmented: a row of pill options for small exclusive choices, the same
 * shape as the docs preview knobs.
 *
 *   <Segmented label="Export" options={["cli", "jsx", "ansi", "svg"]} value={f} onValueChange={setF} />
 *
 * Props
 * - `options`: values, or `{ value, label }` objects when the label differs.
 * - `value`, `onValueChange`: controlled selection.
 * - `label`: accessible name for the group (visually hidden unless `showLabel`).
 * - `showLabel`: print the label before the options in caps. Default false.
 * - `size`: "sm" (28px, default) or "md" (32px).
 * - `className`: classes for the root.
 * Arrow keys move the selection (native radio inputs).
 */

import { useId } from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<Value extends string> =
  | Value
  | { readonly value: Value; readonly label: React.ReactNode };

export interface SegmentedProps<Value extends string> {
  /** The choices, in order. */
  options: readonly SegmentedOption<Value>[];
  /** Selected value. */
  value: Value;
  /** Called with the newly selected value. */
  onValueChange: (value: Value) => void;
  /** Accessible group name. */
  label: string;
  /** Print `label` before the options. Default false. */
  showLabel?: boolean;
  /** Row height: "sm" is 28px, "md" is 32px. Default "sm". */
  size?: "sm" | "md";
  className?: string;
}

const optionValue = <Value extends string>(
  option: SegmentedOption<Value>
): Value => (typeof option === "string" ? option : option.value);

const optionLabel = <Value extends string>(
  option: SegmentedOption<Value>
): React.ReactNode => (typeof option === "string" ? option : option.label);

export const Segmented = <Value extends string>({
  options,
  value,
  onValueChange,
  label,
  showLabel = false,
  size = "sm",
  className,
}: SegmentedProps<Value>) => {
  const name = useId();
  const labelId = useId();

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span
        id={labelId}
        className={
          showLabel
            ? "text-muted-foreground font-mono text-[10px] tracking-[0.08em] uppercase"
            : "sr-only"
        }
      >
        {label}
      </span>
      <div
        className={cn(
          "bg-muted/70 flex items-stretch rounded-full p-0.5 font-mono",
          size === "sm" ? "h-7 text-[11px]" : "h-8 text-xs"
        )}
      >
        {options.map((option) => {
          const current = optionValue(option);
          return (
            <label
              key={current}
              className="text-muted-foreground hover:text-foreground has-[:checked]:bg-background has-[:checked]:text-foreground has-[:focus-visible]:ring-ring/50 relative flex cursor-pointer items-center rounded-full px-2.5 transition-colors duration-150 select-none has-[:checked]:shadow-[0_1px_2px_rgb(0_0_0/0.08)] has-[:focus-visible]:ring-[3px] dark:has-[:checked]:bg-white/[0.11] dark:has-[:checked]:shadow-none"
            >
              <input
                type="radio"
                name={name}
                value={current}
                checked={current === value}
                onChange={() => onValueChange(current)}
                className="sr-only"
              />
              {optionLabel(option)}
            </label>
          );
        })}
      </div>
    </div>
  );
};
