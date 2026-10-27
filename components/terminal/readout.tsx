/**
 * Readout: a labelled instrument reading, caps label over a tabular value.
 *
 *   <Readout label="Glyphs" value="12,296" unit="cells" />
 *
 * Props
 * - `label`: caps label above the value.
 * - `value`: the reading (tabular, slashed-zero figures).
 * - `unit`: dim suffix after the value.
 * - `tone`: "default" or "ink". Default "default".
 * - `size`: "sm" (13px value, default) or "lg" (22px value).
 * - all other `div` props.
 */

import { cn } from "@/lib/utils";

export interface ReadoutProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** Caps label above the value. */
  label: React.ReactNode;
  /** The reading. */
  value: React.ReactNode;
  /** Dim suffix after the value. */
  unit?: React.ReactNode;
  /** Value colour. Default "default". */
  tone?: "default" | "ink";
  /** Value size: "sm" is 13px, "lg" is 22px. Default "sm". */
  size?: "sm" | "lg";
}

export const Readout = ({
  label,
  value,
  unit,
  tone = "default",
  size = "sm",
  className,
  ...props
}: ReadoutProps) => (
  <div
    data-slot="readout"
    className={cn("flex min-w-0 flex-col gap-1", className)}
    {...props}
  >
    <span className="label-caps text-muted-foreground">{label}</span>
    <span
      className={cn(
        "tabular truncate font-mono leading-none",
        size === "sm" ? "text-[13px]" : "text-[22px] tracking-tight",
        tone === "ink" ? "text-ink" : "text-foreground"
      )}
    >
      {value}
      {unit ? (
        <span className="text-muted-foreground ml-1 text-[0.75em]">{unit}</span>
      ) : null}
    </span>
  </div>
);
