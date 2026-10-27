"use client";

/**
 * Segmented: a terminal radio row, `[ cli │ jsx │ ansi │ svg ]`. Use it for
 * export formats, charset pickers and other small exclusive choices.
 *
 *   <Segmented label="Export" options={["cli", "jsx", "ansi", "svg"]} value={f} onValueChange={setF} />
 *
 * Props
 * - `options`: values, or `{ value, label }` objects when the label differs.
 * - `value`, `onValueChange`: controlled selection.
 * - `label`: accessible name for the group (visually hidden unless `showLabel`).
 * - `showLabel`: print the label before the options in caps. Default false.
 * - `size`: "sm" (24px, default) or "md" (32px).
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
  /** Row height: "sm" is 24px, "md" is 32px. Default "sm". */
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
      className={cn("inline-flex items-center gap-2 font-mono", className)}
    >
      <span
        id={labelId}
        className={showLabel ? "label-caps text-muted-foreground" : "sr-only"}
      >
        {label}
      </span>
      <div
        className={cn(
          "divide-border flex items-stretch divide-x rounded-xs border",
          size === "sm" ? "h-6 text-[11px]" : "h-8 text-xs"
        )}
      >
        {options.map((option) => {
          const current = optionValue(option);
          return (
            <label
              key={current}
              className="text-muted-foreground hover:text-foreground has-[:checked]:bg-ink-soft has-[:checked]:text-ink has-[:focus-visible]:outline-ring relative flex cursor-pointer items-center px-2 transition-colors duration-150 select-none has-[:focus-visible]:z-10 has-[:focus-visible]:outline has-[:focus-visible]:outline-offset-1"
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
