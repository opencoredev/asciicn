import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { cssColor } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * Font size per cell height for DOM glyphs. Cascadia Mono's full block and
 * box lines are 1.17em tall, so at this size blocks and lines in
 * neighbouring rows touch instead of leaving a hairline between them.
 */
const GLYPH_EM = 1.17;

/** The glyphs a divider is drawn with. */
export type DividerVariant =
  | "light"
  | "heavy"
  | "double"
  | "dashed"
  | "ascii"
  | "dots"
  | "beads"
  | "diamonds";

export type DividerAlign = "start" | "center" | "end";

export interface DividerProps extends Omit<
  ComponentProps<"div">,
  "children" | "color"
> {
  /** The glyph pattern. Default `"light"` (`─`). */
  variant?: DividerVariant;
  /** `horizontal` runs across its container, `vertical` down a flex row. Default `"horizontal"`. */
  orientation?: "horizontal" | "vertical";
  /** Text set into the rule, such as `"or"`. Also its accessible name when it is a string. */
  label?: ReactNode;
  /** Where the label sits along the rule. Default `"center"`. */
  align?: DividerAlign;
  /** A glyph set into the middle when there is no label, such as `"◆"`. */
  ornament?: string;
  /** Glyph colour: a palette name or any CSS colour. Default `"grey"`. */
  color?: AsciiColor;
  /** Glyph cell height in CSS pixels. Default `--ascii-cell`. */
  cell?: number;
}

/** Each pattern across and down. A pattern repeats from the label outwards. */
const PATTERNS = {
  ascii: { horizontal: "-", vertical: "|" },
  beads: { horizontal: "·•", vertical: "·•" },
  dashed: { horizontal: "┄", vertical: "┆" },
  diamonds: { horizontal: "◆ ", vertical: "◆ " },
  dots: { horizontal: "·", vertical: "·" },
  double: { horizontal: "═", vertical: "║" },
  heavy: { horizontal: "━", vertical: "┃" },
  light: { horizontal: "─", vertical: "│" },
} as const satisfies Record<
  DividerVariant,
  Record<"horizontal" | "vertical", string>
>;

/**
 * Glyphs per run: enough for a 4K-wide rule at a 6px cell. The run is
 * clipped to its box, so it never sets the divider's size.
 */
const RUN_CELLS = 640;
/** The run before a start- or end-aligned label, in cells. */
const LEAD_CELLS = 4;

const cellText = (cell: number | undefined): CSSProperties => {
  const height = cell === undefined ? "var(--ascii-cell, 12px)" : `${cell}px`;
  return {
    fontFamily: "var(--ascii-font, monospace)",
    fontSize: `calc(${height} / ${GLYPH_EM})`,
    fontVariantLigatures: "none",
    letterSpacing: 0,
    lineHeight: height,
  };
};

const repeatTo = (pattern: string, cells: number): string => {
  const glyphs = [...pattern];
  return Array.from(
    { length: cells },
    (_, index) => glyphs[index % glyphs.length]
  ).join("");
};

/**
 * One run of the pattern, clipped to its box. `toward` is the side that
 * meets the label, so the pattern starts cleanly there and any cut glyph
 * lands at the far end.
 */
const Run = ({
  pattern,
  vertical,
  toward,
  fixed,
}: {
  pattern: string;
  vertical: boolean;
  toward: "start" | "end";
  fixed: boolean;
}) => {
  const glyphs = repeatTo(pattern, fixed ? LEAD_CELLS : RUN_CELLS);
  // Read the pattern outward from the label on both sides.
  const text = toward === "end" ? [...glyphs].toReversed().join("") : glyphs;
  if (vertical && !fixed) {
    // Positioned out of flow, so the run fills the row's height without
    // setting it.
    return (
      <span
        aria-hidden="true"
        className="relative min-h-0 w-[1ch] flex-1 overflow-hidden whitespace-pre"
      >
        <span
          className={cn(
            "absolute inset-x-0 block",
            toward === "end" ? "bottom-0" : "top-0"
          )}
        >
          {[...text].join("\n")}
        </span>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex overflow-hidden whitespace-pre",
        vertical ? "w-[1ch] flex-col" : "",
        fixed ? "shrink-0" : "min-h-0 min-w-0 flex-1",
        toward === "end" ? "justify-end" : "justify-start"
      )}
    >
      <span className={vertical ? "block" : "shrink-0"}>
        {vertical ? [...text].join("\n") : text}
      </span>
    </span>
  );
};

/**
 * A rule drawn in glyphs: box-drawing lines (light, heavy, double, dashed),
 * plain ASCII, or a repeating pattern of dots, beads or diamonds. A label
 * or a single ornament glyph can sit in it, at the start, centre or end.
 * Vertical dividers stretch down a flex row.
 */
export const Divider = ({
  variant = "light",
  orientation = "horizontal",
  label,
  align = "center",
  ornament,
  color = "grey",
  cell,
  className,
  style,
  ...props
}: DividerProps) => {
  const vertical = orientation === "vertical";
  const pattern = PATTERNS[variant][orientation];
  const content = label ?? ornament;
  const hasContent =
    content !== undefined && content !== null && content !== "";

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={typeof label === "string" ? label : undefined}
      className={cn(
        "flex items-center select-none",
        vertical ? "w-max flex-col self-stretch" : "w-full flex-row",
        className
      )}
      style={{ ...cellText(cell), color: cssColor(color), ...style }}
      {...props}
    >
      <Run
        pattern={pattern}
        vertical={vertical}
        toward="end"
        fixed={hasContent && align === "start"}
      />
      {hasContent ? (
        <span
          aria-hidden={label === undefined ? true : undefined}
          className={cn(
            "shrink-0 whitespace-nowrap",
            vertical ? "py-[0.5lh]" : "px-[1ch]",
            label === undefined
              ? ""
              : "text-muted-foreground font-mono text-xs leading-none"
          )}
        >
          {content}
        </span>
      ) : null}
      {hasContent ? (
        <Run
          pattern={pattern}
          vertical={vertical}
          toward="start"
          fixed={align === "end"}
        />
      ) : null}
    </div>
  );
};
