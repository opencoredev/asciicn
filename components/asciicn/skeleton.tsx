"use client";

import { useRef } from "react";
import type { ComponentProps, CSSProperties } from "react";

import { cssColor, useFrameLoop } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * Font size per cell height for DOM glyphs. Cascadia Mono's full block and
 * box lines are 1.17em tall, so at this size blocks and lines in
 * neighbouring rows touch instead of leaving a hairline between them.
 */
const GLYPH_EM = 1.17;

/** `text` is a paragraph of lines, `block` a filled rectangle, `circle` a glyph disc. */
export type SkeletonShape = "text" | "block" | "circle";

/**
 * `sweep` passes a dense band across every skeleton on the page, as one
 * light; `pulse` breathes all glyphs between the first two levels; `none`
 * holds still.
 */
export type SkeletonMotion = "sweep" | "pulse" | "none";

export interface SkeletonProps extends Omit<
  ComponentProps<"div">,
  "children" | "color"
> {
  /** What to stand in for. Default `"block"`. */
  shape?: SkeletonShape;
  /** `text`: number of lines; the last one is shorter. Default 3. */
  lines?: number;
  /** `block`: height in rows of cells. Default 3. */
  rows?: number;
  /** `circle`: diameter in rows of cells. Default 3. */
  size?: number;
  /** How it moves while loading. Default `"sweep"`; still under reduced motion. */
  motion?: SkeletonMotion;
  /** Glyphs from resting to the peak of the sweep. Default `"░▒▓"`. */
  chars?: string;
  /** Glyph colour: a palette name or any CSS colour. Default `"grey"`. */
  color?: AsciiColor;
  /** Glyph cell height in CSS pixels. Default `--ascii-cell`. */
  cell?: number;
}

/** Glyphs per line before clipping: wide enough for any card or table cell. */
const RUN_CELLS = 320;
/** Widths of text lines, by position; the last line uses `LAST_LINE`. */
const LINE_WIDTHS = ["100%", "94%", "97%", "88%"] as const;
const LAST_LINE = "62%";
/** One pass of the sweep across the viewport, in seconds. */
const SWEEP_SECONDS = 1.9;
/** Half-widths of the sweep band's peak and shoulder, in cells. */
const PEAK_CELLS = 1.5;
const SHOULDER_CELLS = 5;
const PROBE = "0000000000";

const cellText = (cell: number | undefined): CSSProperties => {
  const height = cell === undefined ? "var(--ascii-cell, 12px)" : `${cell}px`;
  return {
    fontFamily: "var(--ascii-font, monospace)",
    fontSize: `calc(${height} / ${GLYPH_EM})`,
    fontVariantLigatures: "none",
    letterSpacing: 0,
    lineHeight: height,
    whiteSpace: "pre",
  };
};

/** Rows of a disc `size` rows across. Cells are half as wide as tall, so a row spans twice as many columns. */
const discRows = (size: number): string[] => {
  const rows = Math.max(1, Math.round(size));
  const columns = rows * 2;
  return Array.from({ length: rows }, (_, row) => {
    const y = ((row + 0.5) / rows) * 2 - 1;
    let line = "";
    for (let column = 0; column < columns; column += 1) {
      const x = ((column + 0.5) / columns) * 2 - 1;
      line += x * x + y * y <= 1.08 ? "x" : " ";
    }
    return line;
  });
};

interface Line {
  /** CSS width of the line. */
  readonly width: string;
  /** Which cells hold a glyph (`x`), or null for every cell. */
  readonly mask: string | null;
}

const shapeLines = ({
  shape,
  lines,
  rows,
  size,
}: {
  shape: SkeletonShape;
  lines: number;
  rows: number;
  size: number;
}): Line[] => {
  switch (shape) {
    case "text": {
      const count = Math.max(1, Math.round(lines));
      return Array.from({ length: count }, (_, index) => ({
        mask: null,
        width:
          count > 1 && index === count - 1
            ? LAST_LINE
            : (LINE_WIDTHS[index % LINE_WIDTHS.length] ?? "100%"),
      }));
    }
    case "block": {
      return Array.from({ length: Math.max(1, Math.round(rows)) }, () => ({
        mask: null,
        width: "100%",
      }));
    }
    case "circle": {
      return discRows(size).map((mask) => ({
        mask,
        width: `${mask.length}ch`,
      }));
    }
    default: {
      const exhaustive: never = shape;
      return exhaustive;
    }
  }
};

const lineText = (
  line: Line,
  glyphAt: (column: number) => string,
  cells: number
): string => {
  let out = "";
  const count = line.mask === null ? cells : line.mask.length;
  for (let column = 0; column < count; column += 1) {
    out +=
      line.mask === null || line.mask[column] === "x" ? glyphAt(column) : " ";
  }
  return out;
};

/**
 * A loading placeholder made of shade glyphs: lines of text, a block or a
 * disc. A dense band of `▒▓` sweeps across it, positioned against the
 * viewport, so every skeleton on the page shimmers as one. The glyphs are
 * hidden from screen readers: mark the region that is loading with
 * `aria-busy` and give it a text status.
 */
export const Skeleton = ({
  shape = "block",
  lines = 3,
  rows = 3,
  size = 3,
  motion = "sweep",
  chars = "░▒▓",
  color = "grey",
  cell,
  className,
  style,
  ...props
}: SkeletonProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const glyphs = [...chars];
  const rest = glyphs[0] ?? "░";
  const shoulder = glyphs[1] ?? rest;
  const peak = glyphs.at(-1) ?? shoulder;
  const shapeOf = shapeLines({ lines, rows, shape, size });

  useFrameLoop(
    () => {
      const probe = probeRef.current;
      if (!probe) {
        return;
      }
      const advance = probe.getBoundingClientRect().width / PROBE.length;
      if (advance <= 0) {
        return;
      }
      // A shared clock rather than this loop's own, so every skeleton on
      // the page agrees on where the band is.
      const now = performance.now() / 1000;
      const phase = (now / SWEEP_SECONDS) % 1;
      // Read every line's position first, then write, to avoid
      // interleaving layout reads with DOM writes.
      const boxes = lineRefs.current.map((el) => el?.getBoundingClientRect());
      for (const [index, el] of lineRefs.current.entries()) {
        const line = shapeOf[index];
        const box = boxes[index];
        if (!el || !line || !box) {
          continue;
        }
        const cells = Math.ceil(box.width / advance);
        let glyphAt = (_column: number) => rest;
        if (motion === "sweep") {
          const viewport = window.innerWidth;
          const margin = SHOULDER_CELLS * advance;
          const bandX = -margin + phase * (viewport + margin * 2);
          glyphAt = (column) => {
            const distance =
              Math.abs(box.left + (column + 0.5) * advance - bandX) / advance;
            if (distance < PEAK_CELLS) {
              return peak;
            }
            return distance < SHOULDER_CELLS ? shoulder : rest;
          };
        } else if (motion === "pulse") {
          const lit = Math.sin(phase * Math.PI * 2) > 0.35;
          glyphAt = () => (lit ? shoulder : rest);
        }
        const text = lineText(line, glyphAt, cells);
        if (el.textContent !== text) {
          el.textContent = text;
        }
      }
    },
    { enabled: motion !== "none", fps: 30, target: rootRef }
  );

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn(
        "relative flex flex-col overflow-hidden select-none",
        shape === "circle" ? "w-max" : "w-full",
        className
      )}
      style={{
        ...cellText(cell),
        color: `color-mix(in oklab, ${cssColor(color)} 70%, transparent)`,
        gap: shape === "text" ? "0.5lh" : 0,
        ...style,
      }}
      {...props}
    >
      <span ref={probeRef} className="invisible absolute top-0 left-0">
        {PROBE}
      </span>
      {shapeOf.map((line, index) => (
        <span
          // Lines are positional and never reorder.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          ref={(el) => {
            lineRefs.current[index] = el;
          }}
          className="block max-w-full overflow-hidden"
          style={{ width: line.width }}
        >
          {lineText(line, () => rest, RUN_CELLS)}
        </span>
      ))}
    </div>
  );
};
