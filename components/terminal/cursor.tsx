/**
 * Cursor: a block caret that blinks in steps, like a terminal cursor.
 * Holds still (solid) under reduced motion.
 *
 * Props
 * - `shape`: "block" (`█`, default), "bar" (`▏`) or "underline" (`▁`).
 * - all other `span` props. Decorative: `aria-hidden`.
 */

import { cn } from "@/lib/utils";

export interface CursorProps extends Omit<
  React.ComponentProps<"span">,
  "children"
> {
  /** Caret shape. Default "block". */
  shape?: "block" | "bar" | "underline";
}

const GLYPHS = {
  bar: "▏",
  block: "█",
  underline: "▁",
} as const satisfies Record<NonNullable<CursorProps["shape"]>, string>;

export const Cursor = ({
  shape = "block",
  className,
  ...props
}: CursorProps) => (
  <span
    aria-hidden
    data-slot="cursor"
    className={cn(
      "text-ink inline-block leading-none select-none motion-safe:animate-[caret-blink_1.05s_steps(1,end)_infinite]",
      className
    )}
    {...props}
  >
    {GLYPHS[shape]}
  </span>
);
