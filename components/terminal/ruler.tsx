"use client";

/**
 * Ruler: a cell-grid ruler, the column counter from a text editor
 * (`....:....1....:....2`). Lay it along the top or side of a glyph pane
 * with the same `cell` size and every tick sits over a glyph column or row.
 *
 *   <Ruler cell={metrics.width} />                       // columns
 *   <Ruler orientation="vertical" cell={metrics.height} />  // rows
 *
 * Props
 * - `orientation`: "horizontal" (columns, default) or "vertical" (rows).
 * - `cell`: distance between ticks in CSS px: the cell width for columns,
 *   the cell height for rows. Default 8.
 * - `cells`: how many cells to draw. Default: as many as fit, measured.
 * - `start`: number of the first cell (1-based). Default 1.
 * - `highlight`: a cell (number) or inclusive range ([from, to]) drawn in
 *   the ink colour, e.g. the column under the pointer.
 * - `variant`: "glyph" draws `.`, `:` and digits; "ticks" draws 1px
 *   hairlines of three heights with a number every ten. Default "glyph".
 * - all other `div` props. The ruler is decorative (`aria-hidden`).
 */

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface RulerProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** "horizontal" counts columns, "vertical" counts rows. Default "horizontal". */
  orientation?: "horizontal" | "vertical";
  /** Distance between ticks in CSS px. Default 8. */
  cell?: number;
  /** Cells to draw. Default: as many as fit the element. */
  cells?: number;
  /** Number of the first cell, 1-based. Default 1. */
  start?: number;
  /** Cell or inclusive [from, to] range to draw in ink. */
  highlight?: number | readonly [from: number, to: number];
  /** "glyph" (`....:....1`) or "ticks" (hairlines). Default "glyph". */
  variant?: "glyph" | "ticks";
}

// Rendered on the server before the element can be measured; enough to fill
// a wide screen at small cells, clipped by overflow.
const SSR_CELLS = 240;

const glyphFor = (index: number, vertical: boolean): string => {
  if (index % 10 === 0) {
    return String((index / 10) % 10);
  }
  if (index % 5 === 0) {
    return vertical ? "-" : ":";
  }
  return vertical ? "·" : ".";
};

const inRange = (
  index: number,
  highlight: RulerProps["highlight"]
): boolean => {
  if (highlight === undefined) {
    return false;
  }
  if (typeof highlight === "number") {
    return index === highlight;
  }
  return index >= highlight[0] && index <= highlight[1];
};

const useFitCount = (
  ref: React.RefObject<HTMLDivElement | null>,
  cell: number,
  vertical: boolean,
  fixed: number | undefined
): number => {
  const [count, setCount] = useState(fixed ?? SSR_CELLS);

  useLayoutEffect(() => {
    const el = ref.current;
    if (fixed !== undefined || !el) {
      return;
    }
    const measure = () => {
      const size = vertical ? el.clientHeight : el.clientWidth;
      setCount(Math.max(1, Math.ceil(size / cell)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, cell, vertical, fixed]);

  return fixed ?? count;
};

export const Ruler = ({
  orientation = "horizontal",
  cell = 8,
  cells,
  start = 1,
  highlight,
  variant = "glyph",
  className,
  style,
  ...props
}: RulerProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const vertical = orientation === "vertical";
  const count = useFitCount(ref, cell, vertical, cells);
  const indices = Array.from({ length: count }, (_, i) => start + i);

  if (variant === "ticks") {
    const tickStyle: React.CSSProperties & Record<"--cell", string> = {
      ...style,
      "--cell": `${cell}px`,
    };
    return (
      <div
        ref={ref}
        aria-hidden
        data-slot="ruler"
        data-orientation={orientation}
        className={cn(
          "text-faint tabular pointer-events-none relative overflow-hidden font-mono text-[9px] leading-none select-none",
          vertical ? "h-full w-6" : "h-4 w-full",
          className
        )}
        style={tickStyle}
        {...props}
      >
        <div
          className={cn(
            "absolute",
            vertical
              ? "inset-y-0 right-0 w-3 bg-[repeating-linear-gradient(to_bottom,currentColor_0_1px,transparent_1px_var(--cell)),repeating-linear-gradient(to_bottom,currentColor_0_1px,transparent_1px_calc(var(--cell)*5)),repeating-linear-gradient(to_bottom,currentColor_0_1px,transparent_1px_calc(var(--cell)*10))] bg-[length:4px_100%,7px_100%,100%_100%] bg-right bg-no-repeat"
              : "inset-x-0 bottom-0 h-3 bg-[repeating-linear-gradient(to_right,currentColor_0_1px,transparent_1px_var(--cell)),repeating-linear-gradient(to_right,currentColor_0_1px,transparent_1px_calc(var(--cell)*5)),repeating-linear-gradient(to_right,currentColor_0_1px,transparent_1px_calc(var(--cell)*10))] bg-[length:100%_4px,100%_7px,100%_100%] bg-bottom bg-no-repeat"
          )}
        />
        {indices
          .filter((index) => index % 10 === 0)
          .map((index) => (
            <span
              key={index}
              className={cn(
                "absolute",
                inRange(index, highlight) && "text-ink",
                vertical ? "left-0" : "top-0"
              )}
              style={
                vertical
                  ? { top: (index - start) * cell + 2 }
                  : { left: (index - start) * cell + 3 }
              }
            >
              {index}
            </span>
          ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      aria-hidden
      data-slot="ruler"
      data-orientation={orientation}
      className={cn(
        "text-faint tabular pointer-events-none flex overflow-hidden font-mono text-[10px] leading-none select-none",
        vertical ? "h-full w-4 flex-col" : "h-4 w-full",
        className
      )}
      style={style}
      {...props}
    >
      {indices.map((index) => (
        <span
          key={index}
          className={cn(
            "flex shrink-0 items-center justify-center",
            index % 10 === 0 && "text-muted-foreground",
            inRange(index, highlight) && "bg-ink-soft text-ink"
          )}
          style={vertical ? { height: cell } : { width: cell }}
        >
          {glyphFor(index, vertical)}
        </span>
      ))}
    </div>
  );
};
