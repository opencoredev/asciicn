/**
 * StatusBar: one quiet line of readouts under a stage. Left and right
 * groups of segments, separated by a middle dot.
 *
 *   <StatusBar
 *     left={<><StatusItem label="charset" value="braille" /><StatusItem value="212×58" /></>}
 *     right={<StatusItem label="fps" value={fps} tone="ink" live />}
 *   />
 *
 * StatusBar props
 * - `left`, `right`: segment groups (usually `StatusItem`s). Separators are
 *   drawn between siblings automatically.
 * - `size`: "sm" (24px, default) or "md" (28px).
 * - `bordered`: which edge gets a 1px rule: "top" | "bottom" | "both" | "none" (default "top").
 * - `children`: free content between the groups (takes the remaining space).
 * - all other `div` props.
 *
 * StatusItem props
 * - `label`: dim key shown before the value (e.g. "charset").
 * - `value`: the reading. Numbers get tabular, slashed-zero figures.
 * - `tone`: "default" | "ink" | "muted" | "warn" (default "default").
 * - `live`: shows a small dot before the item, for values that update live.
 * - all other `span` props.
 */

import { cn } from "@/lib/utils";

export interface StatusBarProps extends React.ComponentProps<"div"> {
  /** Segments aligned left. */
  left?: React.ReactNode;
  /** Segments aligned right. */
  right?: React.ReactNode;
  /** Bar height: "sm" is 24px, "md" is 28px. Default "sm". */
  size?: "sm" | "md";
  /** Edge that carries the 1px rule. Default "top". */
  bordered?: "top" | "bottom" | "both" | "none";
}

const BORDERS = {
  both: "border-y",
  bottom: "border-b",
  none: "",
  top: "border-t",
} as const satisfies Record<NonNullable<StatusBarProps["bordered"]>, string>;

// Separators come from CSS so callers can pass any number of items, or
// conditionally render some, without managing dividers.
const GROUP =
  "flex min-w-0 items-center gap-x-2 overflow-hidden whitespace-nowrap [&>*+*]:before:text-muted-foreground/50 [&>*+*]:before:mr-2 [&>*+*]:before:content-['·']";

export const StatusBar = ({
  left,
  right,
  size = "sm",
  bordered = "top",
  className,
  children,
  ...props
}: StatusBarProps) => (
  <div
    data-slot="status-bar"
    className={cn(
      "text-muted-foreground tabular flex w-full items-center justify-between gap-4 px-3 font-mono text-[11px] leading-none",
      size === "sm" ? "h-6" : "h-7",
      BORDERS[bordered],
      className
    )}
    {...props}
  >
    {left ? <div className={GROUP}>{left}</div> : null}
    {children ? <div className="min-w-0 flex-1">{children}</div> : null}
    {right ? (
      <div className={cn(GROUP, "ml-auto justify-end")}>{right}</div>
    ) : null}
  </div>
);

/** A small dot that marks a live reading. */
export const LiveDot = ({ className }: { className?: string }) => (
  <span
    aria-hidden
    className={cn(
      "bg-foreground/70 inline-block size-1.5 shrink-0 rounded-full",
      className
    )}
  />
);

export interface StatusItemProps extends Omit<
  React.ComponentProps<"span">,
  "children"
> {
  /** Dim key shown before the value. */
  label?: React.ReactNode;
  /** The reading itself. */
  value: React.ReactNode;
  /** Colour of the value. Default "default". */
  tone?: "default" | "ink" | "muted" | "warn";
  /** Prefix a small dot, for values that update live. */
  live?: boolean;
}

const TONES = {
  default: "text-foreground",
  ink: "text-foreground",
  muted: "text-muted-foreground",
  warn: "text-destructive",
} as const satisfies Record<NonNullable<StatusItemProps["tone"]>, string>;

export const StatusItem = ({
  label,
  value,
  tone = "default",
  live = false,
  className,
  ...props
}: StatusItemProps) => (
  <span
    data-slot="status-item"
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  >
    {live ? <LiveDot /> : null}
    {label ? <span className="text-muted-foreground">{label}</span> : null}
    <span className={TONES[tone]}>{value}</span>
  </span>
);
