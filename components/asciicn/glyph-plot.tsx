"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";

import {
  BRAILLE_DOT_BITS,
  brailleChar,
  DEFAULT_CELL,
  DEFAULT_FONT,
  LINE_HEIGHT,
  measureCell,
  QUADRANT_BITS,
  quadrantChar,
  readCell,
  readFont,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * The building block of the asciicn charts: a raster of sub-cell dots that
 * becomes a grid of real glyphs, rendered as DOM text. Text stays crisp at
 * any zoom, can be selected and copied, renders on the server and follows
 * the theme through CSS variables, with no canvas to repaint.
 *
 * Each dot carries an owner (a slice, a series, a marker) so the glyph
 * built from it takes that owner's colour, and hover can light one owner.
 */

/**
 * `braille`: 2 by 4 dots per cell, fine lines and round shapes.
 * `quadrants`: 2 by 2 blocks per cell, a chunky solid look.
 */
export type PlotGlyphs = "braille" | "quadrants";

/** Sub-samples per cell, as [columns, rows]. */
export const PLOT_SUBCELLS = {
  braille: [2, 4],
  quadrants: [2, 2],
} as const satisfies Record<PlotGlyphs, readonly [number, number]>;

/** A grid of sub-cell dots. `owners[y * width + x]` is 0 for empty. */
export interface DotRaster {
  readonly glyphs: PlotGlyphs;
  readonly columns: number;
  readonly rows: number;
  /** Dots across: `columns * 2`. */
  readonly width: number;
  /** Dots down: `rows * 4` for braille, `rows * 2` for quadrants. */
  readonly height: number;
  readonly owners: Uint8Array;
}

export const createRaster = ({
  columns,
  rows,
  glyphs,
}: {
  columns: number;
  rows: number;
  glyphs: PlotGlyphs;
}): DotRaster => {
  const [gx, gy] = PLOT_SUBCELLS[glyphs];
  const safeColumns = Math.max(0, Math.floor(columns));
  const safeRows = Math.max(0, Math.floor(rows));
  return {
    columns: safeColumns,
    glyphs,
    height: safeRows * gy,
    owners: new Uint8Array(safeColumns * gx * safeRows * gy),
    rows: safeRows,
    width: safeColumns * gx,
  };
};

/** Set one dot. Dots outside the raster are ignored. */
export const plotDot = (
  raster: DotRaster,
  x: number,
  y: number,
  owner: number
) => {
  const column = Math.round(x);
  const row = Math.round(y);
  if (column < 0 || row < 0 || column >= raster.width || row >= raster.height) {
    return;
  }
  raster.owners[row * raster.width + column] = owner;
};

/**
 * A one-dot line between two dot positions (Bresenham), so lines are
 * exactly one dot wide with no blur. Endpoints round to the nearest dot.
 */
export const plotLine = (
  raster: DotRaster,
  from: readonly [number, number],
  to: readonly [number, number],
  owner: number,
  /** Plot every `dash`-th dot only, for dotted lines. Default 1. */
  dash = 1
) => {
  if (!(from.every(Number.isFinite) && to.every(Number.isFinite))) {
    return;
  }
  let x = Math.round(from[0]);
  let y = Math.round(from[1]);
  const x1 = Math.round(to[0]);
  const y1 = Math.round(to[1]);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let error = dx + dy;
  let step = 0;
  for (;;) {
    if (step % dash === 0) {
      plotDot(raster, x, y, owner);
    }
    step += 1;
    if (x === x1 && y === y1) {
      return;
    }
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
};

/**
 * Set every dot whose owner `at(x, y)` returns, sampled at the dot's
 * centre in dot units. Returning 0 leaves the dot as it was.
 */
export const fillDots = (
  raster: DotRaster,
  at: (x: number, y: number) => number
) => {
  const { width, height, owners } = raster;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const owner = at(x + 0.5, y + 0.5);
      if (owner > 0) {
        owners[y * width + x] = owner;
      }
    }
  }
};

/** Glyphs and the owner of each, row-major. Owner 0 draws a space. */
export interface GlyphCells {
  readonly columns: number;
  readonly rows: number;
  readonly glyphs: string[];
  readonly owners: Uint8Array;
}

export const createCells = (columns: number, rows: number): GlyphCells => ({
  columns,
  glyphs: Array.from({ length: columns * rows }, () => " "),
  owners: new Uint8Array(columns * rows),
  rows,
});

/**
 * Turn dots into glyphs. A cell's owner is whichever owner set most of its
 * dots, so a cell on the border of two slices takes one colour.
 */
export const rasterCells = (raster: DotRaster): GlyphCells => {
  const { columns, rows, width, owners, glyphs } = raster;
  const bits = glyphs === "braille" ? BRAILLE_DOT_BITS : QUADRANT_BITS;
  const toGlyph = glyphs === "braille" ? brailleChar : quadrantChar;
  const cells = createCells(columns, rows);
  const counts = new Map<number, number>();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let mask = 0;
      counts.clear();
      for (const [dy, line] of bits.entries()) {
        for (const [dx, bit] of line.entries()) {
          const owner =
            owners[(row * bits.length + dy) * width + column * 2 + dx] ?? 0;
          if (owner > 0) {
            // Each dot sets its own bit once, so adding is the same as or-ing.
            mask += bit;
            counts.set(owner, (counts.get(owner) ?? 0) + 1);
          }
        }
      }
      if (mask === 0) {
        continue;
      }
      let best = 0;
      let most = 0;
      for (const [owner, count] of counts) {
        if (count > most) {
          best = owner;
          most = count;
        }
      }
      const index = row * columns + column;
      cells.glyphs[index] = toGlyph(mask);
      cells.owners[index] = best;
    }
  }
  return cells;
};

/** Put a glyph in a cell. Cells outside the grid are ignored. */
export const putGlyph = (
  cells: GlyphCells,
  column: number,
  row: number,
  glyph: string,
  owner: number
) => {
  if (column < 0 || row < 0 || column >= cells.columns || row >= cells.rows) {
    return;
  }
  const index = row * cells.columns + column;
  cells.glyphs[index] = glyph;
  cells.owners[index] = glyph === " " ? 0 : owner;
};

/** Write text into the grid from a cell, one character per cell. */
export const writeText = (
  cells: GlyphCells,
  column: number,
  row: number,
  text: string,
  owner: number
) => {
  for (const [offset, glyph] of [...text].entries()) {
    putGlyph(cells, column + offset, row, glyph, owner);
  }
};

/** CSS for each owner's glyphs. `undefined` uses the inherited colour. */
export type OwnerPaint = (owner: number) => CSSProperties | undefined;

interface Run {
  owner: number;
  text: string;
  length: number;
}

const runsOf = (cells: GlyphCells, row: number): Run[] => {
  const runs: Run[] = [];
  for (let column = 0; column < cells.columns; column += 1) {
    const index = row * cells.columns + column;
    const owner = cells.owners[index] ?? 0;
    const glyph = cells.glyphs[index] ?? " ";
    const last = runs.at(-1);
    if (last && last.owner === owner) {
      last.text += glyph;
      last.length += 1;
    } else {
      runs.push({ length: 1, owner, text: glyph });
    }
  }
  return runs;
};

/** Font size and line height for glyph cells `cell` pixels tall. */
export const cellTextStyle = (cell: number): CSSProperties => ({
  fontFamily: `var(--ascii-font, ${DEFAULT_FONT})`,
  fontSize: cell / LINE_HEIGHT,
  fontVariantLigatures: "none",
  // Bold Braille has bigger dots, which keeps thin dot lines legible on a
  // light page. Block glyphs fill the cell either way.
  fontWeight: 700,
  letterSpacing: 0,
  lineHeight: `${cell}px`,
});

export interface GlyphRowsProps {
  cells: GlyphCells;
  /** Cell height in CSS pixels. */
  cell: number;
  paint: OwnerPaint;
  className?: string;
  style?: CSSProperties;
}

/**
 * The grid as text: one line per row, a span per run of one owner. Each
 * run is exactly its count of `ch` wide, so a fallback font with a
 * different advance can't push later glyphs out of their cells.
 */
export const GlyphRows = ({
  cells,
  cell,
  paint,
  className,
  style,
}: GlyphRowsProps) => (
  <div
    aria-hidden="true"
    className={cn("whitespace-pre select-text", className)}
    style={{
      ...cellTextStyle(cell),
      width: `${cells.columns}ch`,
      ...style,
    }}
  >
    {Array.from({ length: cells.rows }, (_, row) => {
      let column = 0;
      return (
        // oxlint-disable-next-line react/no-array-index-key -- rows have no identity but their position.
        <div key={row} className="overflow-hidden" style={{ height: cell }}>
          {runsOf(cells, row).map((run) => {
            const start = column;
            column += run.length;
            return run.owner === 0 ? (
              <span key={start}>{run.text}</span>
            ) : (
              <span
                key={start}
                className="inline-block overflow-hidden align-top"
                style={{ width: `${run.length}ch`, ...paint(run.owner) }}
              >
                {run.text}
              </span>
            );
          })}
        </div>
      );
    })}
  </div>
);

/** The cells a box holds, and the shape of one cell. */
export interface CellBox {
  /** Cell height in CSS pixels. */
  cell: number;
  /** Cell width over height, about 0.5 for most monospace fonts. */
  aspect: number;
  /** The measured box, in CSS pixels. 0 before the first measure. */
  width: number;
  height: number;
}

/**
 * The cell size and the box it fits in, re-measured when the box resizes
 * or a web font loads. On the server and the first client render it uses
 * `cell` (or 12px) and a 0.5 aspect, so the markup matches.
 */
export const useCellBox = (
  ref: RefObject<HTMLElement | null>,
  cell?: number
): CellBox => {
  const [box, setBox] = useState<CellBox>({
    aspect: 0.5,
    cell: cell ?? DEFAULT_CELL,
    height: 0,
    width: 0,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const height = cell ?? readCell(el);
      // A large dpr keeps the advance unrounded: the text is laid out in
      // `ch`, which isn't snapped to device pixels either.
      const metrics = measureCell({
        cell: height,
        dpr: 64,
        font: readFont(el),
      });
      const next: CellBox = {
        aspect: metrics.width / metrics.height,
        cell: height,
        height: el.clientHeight,
        width: el.clientWidth,
      };
      setBox((previous) =>
        previous.aspect === next.aspect &&
        previous.cell === next.cell &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    document.fonts?.addEventListener?.("loadingdone", measure);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [ref, cell]);

  return box;
};

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Progress of an intro animation, 0 to 1 and eased, that starts the first
 * time `ref` scrolls into view. Always 1 when `animate` is off or the
 * reader prefers reduced motion.
 */
export const useIntro = (
  ref: RefObject<Element | null>,
  { animate, duration }: { animate: boolean; duration: number }
): number => {
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref, { rootMargin: "0px" });
  const enabled = animate && !reduced;
  const [progress, setProgress] = useState(enabled ? 0 : 1);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setDone(true);
      return;
    }
    if (done || !inView) {
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setProgress(easeOut(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, done, inView, duration]);

  return done ? 1 : progress;
};
