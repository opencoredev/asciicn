"use client";

// Braille and quadrant glyphs are bit masks.
/* oxlint-disable no-bitwise */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ComponentProps,
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  RefObject,
} from "react";

import {
  BRAILLE_BASE,
  BRAILLE_DOT_BITS,
  brailleChar,
  cssColor,
  DEFAULT_CELL,
  EIGHTHS_RIGHT,
  EIGHTHS_UP,
  isInked,
  LINE_HEIGHT,
  measureCell,
  MOTION,
  quadrantChar,
  QUADRANT_BITS,
  readCell,
  readFont,
  SERIES_COLORS,
  useFrameLoop,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { glyphShape, shapePath } from "@/lib/ascii/glyphs";
import { cn } from "@/lib/utils";

/**
 * The shared base of the asciicn charts. Everything is drawn on a grid of
 * glyph cells: lines on a Braille (2x4) or quadrant (2x2) dot grid, areas
 * and bars in eighth blocks over a shade ramp, axes in box drawing and
 * labels in mono text. The grid renders as SVG built from each glyph's
 * geometry, so blocks meet without seams, it stays sharp at any zoom and
 * it renders on the server. Used directly it draws mixed series (bars
 * with a target line, areas with a forecast), and AreaChart, LineChart
 * and BarChart are thin presets over it.
 */

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** The keys of `T` whose values are assignable to `V`. */
export type KeyOfType<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

/**
 * Where a chart reads a field: a key of the datum, or a function. Keys
 * work from Server Components; functions only from Client Components.
 */
export type Accessor<T, V> = KeyOfType<T, V> | ((datum: T) => V);

/** A category label, as text. */
export const readLabel = <T,>(
  datum: T,
  accessor: Accessor<T, string | number>
): string =>
  String(typeof accessor === "function" ? accessor(datum) : datum[accessor]);

/** A value, as a number. Anything that is not a finite number reads as 0. */
export const readValue = <T,>(datum: T, accessor: Accessor<T, number>) => {
  const raw =
    typeof accessor === "function" ? accessor(datum) : datum[accessor];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
};

/**
 * How values are written: `Intl.NumberFormat` options (usable from Server
 * Components) or a function.
 */
export type ValueFormat =
  | Intl.NumberFormatOptions
  | ((value: number) => string);

const COMPACT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 1,
  notation: "compact",
};

/** A formatter for a `ValueFormat`. Default compact, as in 1.2K. */
export const toFormatter = (
  format: ValueFormat = COMPACT
): ((value: number) => string) => {
  if (typeof format === "function") {
    return format;
  }
  const formatter = new Intl.NumberFormat("en", format);
  return (value) => formatter.format(value);
};

export type NonEmpty<T> = readonly [T, ...T[]];

/** One value read from every datum. */
export interface ChartSeries<T> {
  /** Name in the legend, the readout and the data table. */
  label: string;
  /** The key holding this series' value, or a function that reads it. */
  value: Accessor<T, number>;
  /** Colour: a palette name (`"green"`) or any CSS colour. Default: the chart's `colors`, then ink, orange, green, pink, purple, blue, red, grey. */
  color?: AsciiColor;
}

/** A series drawn as a line. */
export interface LineSeries<T> extends ChartSeries<T> {
  type: "line";
  /** Draw the line in dashes, for a target or a previous period. Default false. */
  dashed?: boolean;
  /**
   * A band drawn in sparse dots around the line, such as p10 to p90 or a
   * forecast interval. Both ends are keys of `T` or functions.
   */
  range?: { low: Accessor<T, number>; high: Accessor<T, number> };
}

/** A series drawn as a filled area under its edge. */
export interface AreaSeries<T> extends ChartSeries<T> {
  type: "area";
}

/** A series drawn as bars, one per datum. */
export interface BarSeries<T> extends ChartSeries<T> {
  type: "bar";
}

/** Any series the cartesian chart draws, picked by `type`. */
export type CartesianSeries<T> = LineSeries<T> | AreaSeries<T> | BarSeries<T>;

/**
 * The colour series `index` draws in: its own `color`, then the chart's
 * `colors`, then the default palette (ink, orange, green, pink, ...).
 */
export const seriesColor = (
  color: AsciiColor | undefined,
  index: number,
  colors: readonly AsciiColor[] = []
): AsciiColor =>
  color ??
  colors[index] ??
  SERIES_COLORS[index % SERIES_COLORS.length] ??
  "ink";

/** "Revenue and Costs" / "Revenue, Costs and Refunds". */
export const listLabels = (labels: readonly string[]) =>
  labels.length < 2
    ? (labels[0] ?? "")
    : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1) ?? ""}`;

/** "Area chart of Revenue and Costs, Jan to Dec." */
export const chartSummary = <T,>({
  kind,
  series,
  data,
  x,
}: {
  kind: string;
  series: readonly { label: string }[];
  data: readonly T[];
  x: Accessor<T, string | number>;
}) => {
  const [first] = data;
  const last = data.at(-1);
  const range =
    first === undefined || last === undefined
      ? ""
      : `, ${readLabel(first, x)} to ${readLabel(last, x)}`;
  return `${kind} of ${listLabels(series.map((entry) => entry.label))}${range}.`;
};

// ---------------------------------------------------------------------------
// Scales and curves
// ---------------------------------------------------------------------------

const NICE_STEPS = [1, 2, 2.5, 5, 10];

export interface Scale {
  min: number;
  max: number;
  ticks: readonly number[];
}

/**
 * A domain with round ticks that covers every value. With `zero` it
 * always includes zero, as bars and areas need.
 */
export const niceScale = (
  values: readonly number[],
  { zero = true, count = 4 }: { zero?: boolean; count?: number } = {}
): Scale => {
  const finite = values.filter((value) => Number.isFinite(value));
  const floor = zero ? [0] : [];
  const low = finite.length > 0 ? Math.min(...floor, ...finite) : 0;
  const high = finite.length > 0 ? Math.max(...floor, ...finite) : 1;
  const span = high - low || Math.abs(high) || 1;
  const raw = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    (NICE_STEPS.find((candidate) => candidate * magnitude >= raw) ?? 10) *
    magnitude;
  const min = Math.floor(low / step) * step;
  const max = Math.max(min + step, Math.ceil(high / step) * step);
  const ticks: number[] = [];
  for (let tick = min; tick <= max + step / 2; tick += step) {
    ticks.push(Number(tick.toPrecision(12)));
  }
  return { max, min, ticks };
};

const PERCENT_SCALE: Scale = { max: 100, min: 0, ticks: [0, 25, 50, 75, 100] };
export const formatPercent = (value: number) => `${Math.round(value)}%`;

/**
 * Tangents for a monotone cubic through the points (Fritsch-Carlson), so
 * a smooth curve never overshoots the data: peaks stay at the data.
 */
const monotoneTangents = (xs: readonly number[], ys: readonly number[]) => {
  const count = xs.length;
  const slopes: number[] = [];
  for (let index = 0; index < count - 1; index += 1) {
    slopes.push((ys[index + 1] - ys[index]) / (xs[index + 1] - xs[index] || 1));
  }
  const tangents = xs.map((_, index) => {
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === undefined) {
      return after ?? 0;
    }
    if (after === undefined) {
      return before;
    }
    return before * after <= 0 ? 0 : (before + after) / 2;
  });
  for (let index = 0; index < count - 1; index += 1) {
    const slope = slopes[index];
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
    } else {
      const a = tangents[index] / slope;
      const b = tangents[index + 1] / slope;
      const length = a * a + b * b;
      if (length > 9) {
        const scale = 3 / Math.sqrt(length);
        tangents[index] = scale * a * slope;
        tangents[index + 1] = scale * b * slope;
      }
    }
  }
  return tangents;
};

/** y at any x along the points, straight or smooth. `xs` must rise. */
export const interpolate = (
  xs: readonly number[],
  ys: readonly number[],
  smooth: boolean
): ((x: number) => number) => {
  const count = xs.length;
  const tangents = smooth && count > 2 ? monotoneTangents(xs, ys) : null;
  return (x) => {
    if (count < 2) {
      return ys[0] ?? 0;
    }
    let low = 0;
    let high = count - 1;
    if (x <= xs[0]) {
      return ys[0];
    }
    if (x >= xs[high]) {
      return ys[high];
    }
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (xs[middle] <= x) {
        low = middle;
      } else {
        high = middle;
      }
    }
    const width = xs[high] - xs[low] || 1;
    const t = (x - xs[low]) / width;
    if (tangents === null) {
      return ys[low] + (ys[high] - ys[low]) * t;
    }
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[low] +
      (t3 - 2 * t2 + t) * width * tangents[low] +
      (-2 * t3 + 3 * t2) * ys[high] +
      (t3 - t2) * width * tangents[high]
    );
  };
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

// ---------------------------------------------------------------------------
// Glyph frame
// ---------------------------------------------------------------------------

/** The glyph families a chart draws with. */
export type ChartGlyphs = "braille" | "blocks" | "ascii";

export const CHART_GLYPHS = [
  "braille",
  "blocks",
  "ascii",
] as const satisfies readonly ChartGlyphs[];

/** How bodies of areas and bars are filled. */
export type ChartFill = "gradient" | "solid" | "pattern";

export const CHART_FILLS = [
  "gradient",
  "solid",
  "pattern",
] as const satisfies readonly ChartFill[];

/**
 * Ink slots a cell can take. Fixed slots for the chart's own furniture,
 * then one per series from `seriesInk(0)` up.
 */
export const INK = {
  axis: 1,
  cursor: 2,
  grid: 3,
  label: 4,
  strong: 5,
} as const;

const FIRST_SERIES_INK = 8;
/** Range bands draw in their series' colour, a step quieter, from this slot on. */
const FIRST_BAND_INK = 128;
export const seriesInk = (index: number) => FIRST_SERIES_INK + index;
const bandInk = (index: number) => FIRST_BAND_INK + index;

/** Glyphs that fill only part of their cell from the bottom or the left. */
const PARTIALS = new Set(
  [...EIGHTHS_UP, ...EIGHTHS_RIGHT].filter(
    (glyph) => glyph !== " " && glyph !== "█"
  )
);

/**
 * A grid of glyph cells, each with an ink slot, plus an underlay: a glyph
 * drawn beneath the cell's own, as a terminal paints a background. Where
 * a series ends part way up a cell (an eighth block), the series behind
 * or above it shows through the rest of that cell instead of a gap.
 * Writes outside the grid are ignored, so marks need no clipping.
 */
export class GlyphFrame {
  readonly columns: number;
  readonly rows: number;
  readonly glyphs: string[];
  readonly inks: Uint8Array;
  readonly under: string[];
  readonly underInks: Uint8Array;

  constructor(columns: number, rows: number) {
    this.columns = Math.max(0, Math.floor(columns));
    this.rows = Math.max(0, Math.floor(rows));
    const size = this.columns * this.rows;
    this.glyphs = Array.from({ length: size }, () => " ");
    this.inks = new Uint8Array(size);
    this.under = Array.from({ length: size }, () => " ");
    this.underInks = new Uint8Array(size);
  }

  has(column: number, row: number): boolean {
    return column >= 0 && row >= 0 && column < this.columns && row < this.rows;
  }

  /** Set a cell, replacing what was there (underlay included). */
  put(column: number, row: number, glyph: string, ink: number): void {
    if (this.has(column, row)) {
      const index = row * this.columns + column;
      this.glyphs[index] = glyph;
      this.inks[index] = ink;
      this.under[index] = " ";
      this.underInks[index] = 0;
    }
  }

  /**
   * Set a partial glyph (an eighth block) over what is already in the
   * cell, which moves to the underlay and shows through the empty part.
   */
  cap(column: number, row: number, glyph: string, ink: number): void {
    if (!this.has(column, row)) {
      return;
    }
    const index = row * this.columns + column;
    const previous = this.glyphs[index];
    const previousInk = this.inks[index];
    this.put(column, row, glyph, ink);
    if (previous !== " " && previousInk !== ink && !PARTIALS.has(previous)) {
      this.under[index] = previous;
      this.underInks[index] = previousInk;
    }
  }

  /**
   * Set a body glyph, but tuck it under a partial glyph of another series
   * already in the cell, so a lower layer's edge stays on top.
   */
  fill(column: number, row: number, glyph: string, ink: number): void {
    if (!this.has(column, row)) {
      return;
    }
    const index = row * this.columns + column;
    if (PARTIALS.has(this.glyphs[index]) && this.inks[index] !== ink) {
      this.under[index] = glyph;
      this.underInks[index] = ink;
      return;
    }
    this.put(column, row, glyph, ink);
  }

  /**
   * Set a glyph over the cell (a marker, a line's dots), keeping what was
   * there as the underlay so a line crossing a bar leaves no hole.
   */
  mark(column: number, row: number, glyph: string, ink: number): void {
    if (!this.has(column, row)) {
      return;
    }
    const index = row * this.columns + column;
    const previous = this.glyphs[index];
    const previousInk = this.inks[index];
    // Replacing a glyph of the same series keeps whatever was under it.
    const keep =
      previous !== " " &&
      previousInk >= FIRST_SERIES_INK &&
      previousInk !== ink;
    const under = keep ? previous : this.under[index];
    const underInk = keep ? previousInk : this.underInks[index];
    this.put(column, row, glyph, ink);
    this.under[index] = under;
    this.underInks[index] = underInk;
  }

  /** Whether a cell inside the grid is still blank. */
  blank(column: number, row: number): boolean {
    return (
      this.has(column, row) && this.glyphs[row * this.columns + column] === " "
    );
  }

  write(column: number, row: number, text: string, ink: number): void {
    for (const [offset, glyph] of [...text].entries()) {
      if (glyph !== " ") {
        this.put(column + offset, row, glyph, ink);
      }
    }
  }

  /** The frame as plain text, one line per row. */
  toText(): string {
    const lines: string[] = [];
    for (let row = 0; row < this.rows; row += 1) {
      lines.push(
        this.glyphs
          .slice(row * this.columns, (row + 1) * this.columns)
          .join("")
          .trimEnd()
      );
    }
    return lines.join("\n");
  }
}

/** How one ink slot paints. */
export interface InkPaint {
  /** Any CSS colour. */
  color: string;
  /** 0 to 1. Default 1. */
  opacity?: number;
  /** A soft glow in the ink's colour behind its glyphs. */
  glow?: boolean;
}

/**
 * The chart furniture is the ink colour mixed toward the paper, so axes
 * and labels follow the site palette (phosphor green, amber, ...) and stay
 * quieter than the data.
 */
const mixInk = (share: number) =>
  `color-mix(in oklab, var(--ascii-ink) ${share}%, var(--ascii-paper))`;

export const FURNITURE: Readonly<Record<number, InkPaint>> = {
  [INK.axis]: { color: mixInk(42) },
  [INK.cursor]: { color: mixInk(55) },
  [INK.grid]: { color: mixInk(30) },
  [INK.label]: { color: mixInk(68) },
  [INK.strong]: { color: "var(--ascii-ink)" },
};

// ---------------------------------------------------------------------------
// Rendering: glyph geometry as SVG
// ---------------------------------------------------------------------------

/** Braille dot radius in cell widths, the same as the engine's glyph geometry. */
const BRAILLE_RADIUS = 0.17;
const SHADES = ["░", "▒", "▓"] as const;
type Shade = (typeof SHADES)[number];
const isShade = (glyph: string): glyph is Shade =>
  (SHADES as readonly string[]).includes(glyph);

const round2 = (value: number) => Math.round(value * 100) / 100;

interface TextRun {
  y: number;
  xs: number[];
  chars: string;
}

/** Everything one ink draws: shapes, Braille dots, shade runs and text. */
interface InkDrawing {
  path: string;
  dots: string;
  shades: Map<Shade, string>;
  texts: TextRun[];
}

const rectPath = (x: number, y: number, width: number, height: number) =>
  `M${round2(x)} ${round2(y)}h${round2(width)}v${round2(height)}h${round2(-width)}Z`;

/** Round dots for a Braille mask in the cell at (left, top). */
const brailleDots = (
  mask: number,
  left: number,
  top: number,
  cw: number,
  ch: number
) => {
  let path = "";
  for (const [dotRow, bits] of BRAILLE_DOT_BITS.entries()) {
    for (const [dotColumn, bit] of bits.entries()) {
      if (mask & bit) {
        path += `M${round2(left + (dotColumn === 0 ? 0.3 : 0.7) * cw)} ${round2(top + ((dotRow + 0.5) / 4) * ch)}h0`;
      }
    }
  }
  return path;
};

/** End of a run of `glyph` in `ink` that starts at `column`. */
const runEnd = (frame: GlyphLayer, row: number, column: number) => {
  const { columns, glyphs, inks } = frame;
  const at = row * columns + column;
  let end = column + 1;
  while (
    end < columns &&
    glyphs[row * columns + end] === glyphs[at] &&
    inks[row * columns + end] === inks[at]
  ) {
    end += 1;
  }
  return end;
};

/**
 * Turn a frame into drawing instructions per ink. Runs of full blocks
 * become one rectangle, runs of shades one rectangle filled with a shade
 * tile, Braille cells become round dots, and other geometric glyphs use
 * the engine's shapes. Letters and digits stay text, one x per glyph, so
 * every character sits exactly in its cell.
 */
/** One layer of a frame: its own glyphs, or its underlay. */
interface GlyphLayer {
  columns: number;
  rows: number;
  glyphs: readonly string[];
  inks: Uint8Array;
}

const drawFrame = (frame: GlyphLayer, cw: number, ch: number, rowGap = 0) => {
  const inks = new Map<number, InkDrawing>();
  const drawingOf = (ink: number) => {
    let drawing = inks.get(ink);
    if (drawing === undefined) {
      drawing = { dots: "", path: "", shades: new Map(), texts: [] };
      inks.set(ink, drawing);
    }
    return drawing;
  };
  const { columns, rows, glyphs, inks: cells } = frame;
  for (let row = 0; row < rows; row += 1) {
    const top = row * (ch + rowGap);
    const texts = new Map<number, TextRun>();
    let column = 0;
    while (column < columns) {
      const glyph = glyphs[row * columns + column];
      const ink = cells[row * columns + column];
      const left = column * cw;
      let next = column + 1;
      if (ink !== 0 && glyph !== " ") {
        const drawing = drawingOf(ink);
        const code = glyph.codePointAt(0) ?? 0;
        const shape = glyphShape(glyph);
        if (glyph === "█" || isShade(glyph)) {
          next = runEnd(frame, row, column);
          const rect = rectPath(left, top, (next - column) * cw, ch);
          if (isShade(glyph)) {
            drawing.shades.set(glyph, (drawing.shades.get(glyph) ?? "") + rect);
          } else {
            drawing.path += rect;
          }
        } else if (code > BRAILLE_BASE && code < BRAILLE_BASE + 256) {
          drawing.dots += brailleDots(code - BRAILLE_BASE, left, top, cw, ch);
        } else if (shape === undefined) {
          const run = texts.get(ink) ?? { chars: "", xs: [], y: top + ch / 2 };
          if (!texts.has(ink)) {
            texts.set(ink, run);
            drawing.texts.push(run);
          }
          run.chars += glyph;
          run.xs.push(round2(left + cw / 2));
        } else {
          drawing.path += shapePath(shape, {
            height: ch,
            width: cw,
            x: left,
            y: top,
          });
        }
      }
      column = next;
    }
  }
  return inks;
};

/** A soft glow in `color`, scaled by the theme's `--ascii-glow`. */
const glowFilter = (color: string) =>
  `drop-shadow(0 0 calc(var(--ascii-glow, 0.5) * 5px) ${color})`;

export interface GlyphSvgProps {
  frame: GlyphFrame;
  /** Cell width and height in CSS px. */
  cw: number;
  ch: number;
  /** How each ink slot paints. */
  paint: (ink: number) => InkPaint | undefined;
  /** Space between rows in px, for grids of separate tiles. Default 0. */
  rowGap?: number;
  className?: string;
  style?: CSSProperties;
}

/** Shade tiles for one layer, anchored to the cell grid. */
const ShadePatterns = ({
  id,
  drawing,
  cw,
  ch,
  rowGap,
  paint,
}: {
  id: string;
  drawing: Map<number, InkDrawing>;
  cw: number;
  ch: number;
  rowGap: number;
  paint: GlyphSvgProps["paint"];
}) =>
  [...drawing].flatMap(([ink, { shades }]) =>
    [...shades.keys()].map((shade) => (
      <pattern
        key={`${ink}-${shade}`}
        id={`${id}-${ink}-${SHADES.indexOf(shade)}`}
        width={cw}
        height={ch + rowGap}
        patternUnits="userSpaceOnUse"
      >
        <path
          d={shapePath(glyphShape(shade) ?? [], {
            height: ch,
            width: cw,
            x: 0,
            y: 0,
          })}
          fill={paint(ink)?.color ?? "currentColor"}
        />
      </pattern>
    ))
  );

/** One group per ink: shapes, dots, shade runs and text. */
const InkGroups = ({
  id,
  drawing,
  cw,
  paint,
}: {
  id: string;
  drawing: Map<number, InkDrawing>;
  cw: number;
  paint: GlyphSvgProps["paint"];
}) =>
  [...drawing]
    .toSorted(([a], [b]) => a - b)
    .map(([ink, { path, dots, shades, texts }]) => {
      const look = paint(ink);
      if (look === undefined) {
        return null;
      }
      return (
        <g
          key={ink}
          fill={look.color}
          opacity={look.opacity ?? 1}
          className="transition-opacity duration-200 ease-out motion-reduce:transition-none"
          style={look.glow ? { filter: glowFilter(look.color) } : undefined}
        >
          {path === "" ? null : <path d={path} />}
          {dots === "" ? null : (
            <path
              d={dots}
              fill="none"
              stroke={look.color}
              strokeWidth={round2(BRAILLE_RADIUS * 2 * cw)}
              strokeLinecap="round"
            />
          )}
          {[...shades].map(([shade, rects]) => (
            <path
              key={shade}
              d={rects}
              fill={`url(#${id}-${ink}-${SHADES.indexOf(shade)})`}
            />
          ))}
          {texts.map((run) => (
            <text
              key={run.y}
              x={run.xs.join(" ")}
              y={round2(run.y)}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {run.chars}
            </text>
          ))}
        </g>
      );
    });

/**
 * Draws a glyph frame as one SVG: the underlay first, then the glyphs.
 * Shade tiles are SVG patterns anchored to the cell grid, so a run of
 * shades reads as one even texture across neighbouring cells.
 */
export const GlyphSvg = ({
  frame,
  cw,
  ch,
  paint,
  rowGap = 0,
  className,
  style,
}: GlyphSvgProps) => {
  const uid = useId().replaceAll(":", "");
  const layers = useMemo(
    () => ({
      main: drawFrame(frame, cw, ch, rowGap),
      under: drawFrame(
        {
          columns: frame.columns,
          glyphs: frame.under,
          inks: frame.underInks,
          rows: frame.rows,
        },
        cw,
        ch,
        rowGap
      ),
    }),
    [frame, cw, ch, rowGap]
  );
  const width = frame.columns * cw;
  const height = Math.max(0, frame.rows * (ch + rowGap) - rowGap);
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block overflow-visible select-none", className)}
      style={{
        fontFamily: "var(--ascii-font, ui-monospace, monospace)",
        fontSize: ch / LINE_HEIGHT,
        ...style,
      }}
    >
      <defs>
        <ShadePatterns
          id={`${uid}u`}
          drawing={layers.under}
          cw={cw}
          ch={ch}
          rowGap={rowGap}
          paint={paint}
        />
        <ShadePatterns
          id={`${uid}m`}
          drawing={layers.main}
          cw={cw}
          ch={ch}
          rowGap={rowGap}
          paint={paint}
        />
      </defs>
      <InkGroups id={`${uid}u`} drawing={layers.under} cw={cw} paint={paint} />
      <InkGroups id={`${uid}m`} drawing={layers.main} cw={cw} paint={paint} />
    </svg>
  );
};

/** A short run of glyphs as a legend or readout key. */
export const GlyphSwatch = ({
  glyphs,
  color,
  ch = 12,
  cw = 6,
}: {
  glyphs: string;
  color: string;
  ch?: number;
  cw?: number;
}) => {
  const frame = useMemo(() => {
    const chars = [...glyphs];
    const next = new GlyphFrame(chars.length, 1);
    next.write(0, 0, glyphs, 1);
    return next;
  }, [glyphs]);
  return (
    <GlyphSvg
      frame={frame}
      cw={cw}
      ch={ch}
      paint={() => ({ color })}
      className="shrink-0"
    />
  );
};

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

/** Width the server draws at, in cells, before the box can be measured. */
const SERVER_COLUMNS = 80;

export interface CellGrid {
  /** Cell width and height in CSS px, snapped to device pixels. */
  cw: number;
  ch: number;
  /** Width of the box in CSS px. */
  width: number;
}

/**
 * Measures the box and its glyph cell: `cell` (or `--ascii-cell`) tall,
 * the font's advance wide, both snapped to whole device pixels. Re-measures
 * on resize, zoom and font loads. Before the first measurement (on the
 * server) it reports a fixed default, so the markup hydrates cleanly.
 */
export const useCellGrid = (
  ref: RefObject<HTMLElement | null>,
  cell?: number
): CellGrid => {
  const [grid, setGrid] = useState<CellGrid>(() => {
    const ch = cell ?? DEFAULT_CELL;
    return { ch, cw: ch / 2, width: SERVER_COLUMNS * (ch / 2) };
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const update = () => {
      const metrics = measureCell({
        cell: cell ?? readCell(el),
        font: readFont(el),
      });
      const width = el.clientWidth;
      setGrid((current) =>
        current.cw === metrics.width &&
        current.ch === metrics.height &&
        current.width === width
          ? current
          : { ch: metrics.height, cw: metrics.width, width }
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    // Zoom changes the device pixel ratio, and with it the snapped cell.
    window.addEventListener("resize", update);
    document.fonts?.addEventListener?.("loadingdone", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      document.fonts?.removeEventListener?.("loadingdone", update);
    };
  }, [ref, cell]);
  return grid;
};

/**
 * 0 to 1 over the entrance once the chart is on screen, in whole steps so
 * React redraws at most `steps` times. 1 at once under reduced motion or
 * with `enabled: false`.
 */
export const useReveal = (
  target: RefObject<Element | null>,
  enabled = true,
  { duration = (MOTION.slow + MOTION.base * 2) / 1000, steps = 24 } = {}
) => {
  const [progress, setProgress] = useState(enabled ? 0 : 1);
  useFrameLoop(
    (time) => {
      const linear = Math.min(1, time / duration);
      setProgress(Math.round((1 - (1 - linear) ** 3) * steps) / steps);
    },
    { enabled: enabled && progress < 1, stillTime: duration, target }
  );
  return enabled ? progress : 1;
};

// ---------------------------------------------------------------------------
// Dot grids: lines and fills at sub-cell resolution
// ---------------------------------------------------------------------------

/**
 * A grid of sub-cell dots, 2x4 per cell for Braille and 2x2 for quadrant
 * blocks. Each dot remembers the ink that set it, so overlapping series
 * resolve per cell: the series drawn last owns the cell.
 */
interface DotGrid {
  kind: "braille" | "quadrants";
  columns: number;
  rows: number;
  /** Dots per cell down: 4 for Braille, 2 for quadrants (always 2 across). */
  gy: number;
  width: number;
  height: number;
  owners: Uint8Array;
}

const createDots = (
  kind: "braille" | "quadrants",
  columns: number,
  rows: number
): DotGrid => {
  const gy = kind === "braille" ? 4 : 2;
  const safeColumns = Math.max(0, columns);
  const safeRows = Math.max(0, rows);
  return {
    columns: safeColumns,
    gy,
    height: safeRows * gy,
    kind,
    owners: new Uint8Array(safeColumns * 2 * safeRows * gy),
    rows: safeRows,
    width: safeColumns * 2,
  };
};

const setDot = (grid: DotGrid, x: number, y: number, ink: number) => {
  if (x >= 0 && y >= 0 && x < grid.width && y < grid.height) {
    grid.owners[y * grid.width + x] = ink;
  }
};

/** The dot row for a height in cells above the bottom of the grid. */
const heightToDot = (grid: DotGrid, y: number) =>
  clamp(Math.round((grid.rows - y) * grid.gy - 0.5), 0, grid.height - 1);

/** The bit dot (dx, dy) sets in its cell's glyph mask. */
const dotBit = (kind: DotGrid["kind"], dx: number, dy: number) =>
  kind === "braille" ? BRAILLE_DOT_BITS[dy][dx] : QUADRANT_BITS[dy][dx];

/** The ink ranked highest among the dots of one cell, or 0. */
const cellOwner = (
  grid: DotGrid,
  column: number,
  row: number,
  rank: (ink: number) => number
) => {
  let owner = 0;
  for (let dy = 0; dy < grid.gy; dy += 1) {
    for (let dx = 0; dx < 2; dx += 1) {
      const ink =
        grid.owners[(row * grid.gy + dy) * grid.width + column * 2 + dx];
      if (ink !== 0 && (owner === 0 || rank(ink) > rank(owner))) {
        owner = ink;
      }
    }
  }
  return owner;
};

/**
 * Write every cell with dots into `frame` at (`left`, `top`). The cell
 * takes the ink of the series ranked highest among its dots, and only
 * that series' dots, so a crossing never mixes colours in one glyph.
 */
const composeDots = (
  grid: DotGrid,
  frame: GlyphFrame,
  {
    left,
    top,
    rank,
  }: { left: number; top: number; rank: (ink: number) => number }
) => {
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const owner = cellOwner(grid, column, row, rank);
      if (owner !== 0) {
        let mask = 0;
        for (let dy = 0; dy < grid.gy; dy += 1) {
          for (let dx = 0; dx < 2; dx += 1) {
            if (
              grid.owners[
                (row * grid.gy + dy) * grid.width + column * 2 + dx
              ] === owner
            ) {
              // Each dot owns a distinct bit, so adding them builds the mask.
              mask += dotBit(grid.kind, dx, dy);
            }
          }
        }
        const glyph =
          grid.kind === "braille" ? brailleChar(mask) : quadrantChar(mask);
        frame.mark(left + column, top + row, glyph, owner);
      }
    }
  }
};

/** Dashes on the dot grid: four dots on, two off. */
const dashOn = (x: number) => x % 6 < 4;

/**
 * Plot a curve on a dot grid, one dot per sub-column from `from` to `to`
 * (sub-columns), joining steep steps so the line never breaks.
 */
const rasterCurve = ({
  grid,
  curve,
  from,
  to,
  ink,
  dashed,
}: {
  grid: DotGrid;
  curve: (x: number) => number;
  from: number;
  to: number;
  ink: number;
  dashed: boolean;
}) => {
  let previous: number | null = null;
  const start = Math.round(from);
  for (let x = start; x <= Math.round(to); x += 1) {
    const y = heightToDot(grid, curve(x));
    const on = !dashed || dashOn(x - start);
    if (on) {
      if (previous !== null && Math.abs(y - previous) > 1) {
        // Split the jump between the two columns, so joins stay thin.
        const middle = (previous + y) / 2;
        const step = y > previous ? 1 : -1;
        for (let dot: number = previous + step; dot !== y; dot += step) {
          setDot(
            grid,
            (y > previous ? dot <= middle : dot >= middle) ? x - 1 : x,
            dot,
            ink
          );
        }
      }
      setDot(grid, x, y, ink);
    }
    previous = y;
  }
};

/** An ASCII line through a cell: low, middle or high stroke, or a slope. */
const asciiStroke = (fraction: number) => {
  if (fraction < 1 / 3) {
    return "_";
  }
  return fraction < 2 / 3 ? "-" : "¯";
};

/**
 * Plot a curve in plain ASCII: `_ - ¯` across a cell and `/ \` where it
 * climbs or falls a cell or more.
 */
const asciiCurve = ({
  frame,
  plot,
  curve,
  from,
  to,
  ink,
  dashed,
}: {
  frame: GlyphFrame;
  plot: PlotBox;
  curve: (x: number) => number;
  from: number;
  to: number;
  ink: number;
  dashed: boolean;
}) => {
  const first = Math.floor(from / 2);
  const last = Math.floor(to / 2);
  for (let column = first; column <= last; column += 1) {
    if (dashed && (column - first) % 3 === 2) {
      continue;
    }
    const a = curve(clamp(column * 2 - 0.5, from, to));
    const b = curve(clamp(column * 2 + 1.5, from, to));
    const rowA = clamp(Math.floor(a), 0, plot.rows - 1);
    const rowB = clamp(Math.floor(b), 0, plot.rows - 1);
    const x = plot.left + column;
    if (rowA === rowB) {
      frame.put(x, plot.rowAt(rowA), asciiStroke((a + b) / 2 - rowA), ink);
      continue;
    }
    const glyph = rowB > rowA ? "/" : "\\";
    for (
      let row = Math.min(rowA, rowB);
      row <= Math.max(rowA, rowB);
      row += 1
    ) {
      frame.put(x, plot.rowAt(row), glyph, ink);
    }
  }
};

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

/** How several areas or bars combine. */
export type ChartStack = "none" | "stacked" | "percent";

/** A series ready to draw: values read, stacked and coloured. */
interface PlotSeries {
  index: number;
  type: CartesianSeries<unknown>["type"];
  label: string;
  color: AsciiColor;
  dashed: boolean;
  raw: readonly number[];
  /** Bottom and top of the mark at each datum, in data units. */
  low: readonly number[];
  high: readonly number[];
  range: { low: readonly number[]; high: readonly number[] } | null;
}

/** A value, or NaN (a gap) when it is missing or not a finite number. */
const readMaybe = <T,>(datum: T, accessor: Accessor<T, number>) => {
  const raw =
    typeof accessor === "function" ? accessor(datum) : datum[accessor];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : Number.NaN;
};

/** A value's share of a stack: gaps and negatives count as nothing. */
const positive = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

/** Read and stack every series. Areas stack with areas, bars with bars. Missing values are gaps. */
const prepareSeries = <T,>({
  data,
  series,
  stack,
  colors,
}: {
  data: readonly T[];
  series: readonly CartesianSeries<T>[];
  stack: ChartStack;
  colors: readonly AsciiColor[];
}): PlotSeries[] => {
  const totals = new Map<string, number[]>();
  const running = new Map<string, number[]>();
  const raws = series.map((entry) =>
    data.map((datum) => readMaybe(datum, entry.value))
  );
  if (stack !== "none") {
    for (const [index, entry] of series.entries()) {
      if (entry.type !== "line") {
        const sum = totals.get(entry.type) ?? data.map(() => 0);
        for (const [at, value] of raws[index].entries()) {
          sum[at] += positive(value);
        }
        totals.set(entry.type, sum);
      }
    }
  }
  return series.map((entry, index) => {
    const raw = raws[index];
    const range =
      entry.type === "line" && entry.range !== undefined
        ? {
            high: data.map((datum) =>
              readMaybe(datum, entry.range?.high ?? entry.value)
            ),
            low: data.map((datum) =>
              readMaybe(datum, entry.range?.low ?? entry.value)
            ),
          }
        : null;
    const base = {
      color: seriesColor(entry.color, index, colors),
      dashed: entry.type === "line" && entry.dashed === true,
      index,
      label: entry.label,
      range,
      raw,
      type: entry.type,
    };
    if (entry.type === "line" || stack === "none") {
      return { ...base, high: raw, low: raw.map(() => 0) };
    }
    const sums = totals.get(entry.type) ?? [];
    const floor = running.get(entry.type) ?? data.map(() => 0);
    const low = [...floor];
    const high = raw.map((value, at) => {
      const share =
        stack === "percent"
          ? (positive(value) / (sums[at] || 1)) * 100
          : positive(value);
      floor[at] += share;
      return floor[at];
    });
    running.set(entry.type, floor);
    return { ...base, high, low };
  });
};

/** Glyphs that mark a series' points, distinct per series. */
const MARKERS = {
  ascii: ["o", "x", "+", "*", "#", "@", "%", "&"],
  glyph: ["●", "◆", "■", "▲", "▼", "○", "◇", "□"],
} as const;

export const markerOf = (glyphs: ChartGlyphs, index: number) => {
  const set = glyphs === "ascii" ? MARKERS.ascii : MARKERS.glyph;
  return set[index % set.length] ?? "●";
};

/** Body glyphs: a ramp for gradients, and one texture per series for patterns. */
const BODY = {
  ascii: ["#", "=", "+", ":"],
  blocks: ["█", "▓", "▒", "░"],
} as const;

/** Density of the dot fill (Braille) for each pattern step. */
const DOT_TONES = [1, 0.62, 0.38, 0.2] as const;

/**
 * Where a cell sits in a body that fades away from its edge, 0 to 3: the
 * first cell under the edge is solid, then three steps spread over
 * `span` cells.
 */
const fadeStep = (depth: number, span: number) =>
  depth < 1
    ? 0
    : 1 + Math.min(2, Math.floor(((depth - 1) / Math.max(1, span)) * 3));

/** The glyph for a body cell `depth` cells under the edge. */
const bodyGlyph = ({
  glyphs,
  fill,
  depth,
  span,
  index,
}: {
  glyphs: "blocks" | "ascii";
  fill: ChartFill;
  depth: number;
  span: number;
  index: number;
}) => {
  const ramp = BODY[glyphs];
  switch (fill) {
    case "solid": {
      return ramp[0];
    }
    case "pattern": {
      return ramp[index % ramp.length];
    }
    case "gradient": {
      return ramp[fadeStep(depth, span)];
    }
    default: {
      const exhaustive: never = fill;
      return exhaustive;
    }
  }
};

/** Density of a dot-grid body cell, for ordered dithering on the dots. */
const bodyTone = ({
  fill,
  depth,
  span,
  index,
}: {
  fill: ChartFill;
  depth: number;
  span: number;
  index: number;
}) => {
  switch (fill) {
    case "solid": {
      return 1;
    }
    case "pattern": {
      return DOT_TONES[index % DOT_TONES.length];
    }
    case "gradient": {
      return depth < 1
        ? 0.9
        : 0.55 - 0.47 * Math.min(1, (depth - 1) / Math.max(1, span));
    }
    default: {
      const exhaustive: never = fill;
      return exhaustive;
    }
  }
};

/** A Braille mask with the dots of cell (column, row) inked at `tone`. */
const orderedMask = (column: number, row: number, tone: number) => {
  let mask = 0;
  for (const [dy, bits] of BRAILLE_DOT_BITS.entries()) {
    for (const [dx, bit] of bits.entries()) {
      if (isInked("bayer4", column * 2 + dx, row * 4 + dy, tone)) {
        mask |= bit;
      }
    }
  }
  return mask;
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * The plot inside the frame, in cells. Heights inside it are measured in
 * cells from its bottom edge, so `rowAt(0)` is the bottom plot row.
 */
interface PlotBox {
  left: number;
  top: number;
  columns: number;
  rows: number;
  /** Frame row of plot row `row`, counted from the bottom. */
  rowAt: (row: number) => number;
}

const plotBox = (
  left: number,
  top: number,
  columns: number,
  rows: number
): PlotBox => ({
  columns,
  left,
  rowAt: (row) => top + rows - 1 - row,
  rows,
  top,
});

/** How data sit along x. `point`: on the plot edges and between. `band`: a slot each. */
type Slots = "point" | "band";

interface VerticalLayout {
  plot: PlotBox;
  scale: Scale;
  tickLabels: readonly string[];
  /** Height of a value in cells above the plot bottom. */
  yOf: (value: number) => number;
  /** Sub-column (two per cell) of datum `index`'s centre. */
  xDot: (index: number) => number;
  /** Cells of datum `index`'s band, end exclusive. */
  band: (index: number) => readonly [number, number];
  /** Datum under plot column `column` (from the plot's left). */
  indexAt: (column: number) => number;
  slots: Slots;
  axisRow: number | null;
}

const layoutVertical = ({
  columns,
  rows,
  axes,
  count,
  slots,
  values,
  zero,
  percent,
  formatTick,
}: {
  columns: number;
  rows: number;
  axes: boolean;
  count: number;
  slots: Slots;
  values: readonly number[];
  zero: boolean;
  percent: boolean;
  formatTick: (value: number) => string;
}): VerticalLayout => {
  const top = axes ? 1 : 0;
  const plotRows = Math.max(2, rows - top - (axes ? 2 : 0));
  const scale = percent
    ? PERCENT_SCALE
    : niceScale(values, {
        count: clamp(Math.round(plotRows / 4), 2, 6),
        zero,
      });
  const tickLabels = scale.ticks.map((tick) => formatTick(tick));
  const gutter = axes
    ? Math.max(1, ...tickLabels.map((label) => label.length)) + 2
    : 0;
  const plotColumns = Math.max(2, columns - gutter - (axes ? 1 : 0));
  const plot = plotBox(gutter, top, plotColumns, plotRows);
  const span = scale.max - scale.min || 1;
  const yOf = (value: number) => ((value - scale.min) / span) * plotRows;
  const dots = plotColumns * 2;
  const band = (index: number) =>
    [
      Math.floor((index * plotColumns) / Math.max(1, count)),
      Math.floor(((index + 1) * plotColumns) / Math.max(1, count)),
    ] as const;
  const xDot = (index: number) => {
    if (slots === "band") {
      const [start, end] = band(index);
      return start + end - 0.5;
    }
    return count < 2 ? dots / 2 - 0.5 : (index / (count - 1)) * (dots - 1);
  };
  const indexAt = (column: number) => {
    const raw =
      slots === "band"
        ? Math.floor(((column + 0.5) * count) / plotColumns)
        : Math.round(
            ((column * 2 + 0.5) / Math.max(1, dots - 1)) * (count - 1)
          );
    return clamp(raw, 0, Math.max(0, count - 1));
  };
  return {
    axisRow: axes ? top + plotRows : null,
    band,
    indexAt,
    plot,
    scale,
    slots,
    tickLabels,
    xDot,
    yOf,
  };
};

/** Box-drawing for the axes, or plain ASCII. */
const axisGlyphs = (glyphs: ChartGlyphs) =>
  glyphs === "ascii"
    ? { corner: "+", h: "-", tick: "+", tickUp: "+", v: "|" }
    : { corner: "└", h: "─", tick: "┤", tickUp: "┬", v: "│" };

const labelEnd = (label: { start: number; text: string } | undefined) =>
  label === undefined
    ? Number.NEGATIVE_INFINITY
    : label.start + label.text.length;

/**
 * Which category labels fit: the first, the last, and evenly spaced ones
 * between that never come closer than two cells.
 */
const placeLabels = ({
  labels,
  centers,
  left,
  right,
}: {
  labels: readonly string[];
  centers: readonly number[];
  left: number;
  right: number;
}) => {
  const count = labels.length;
  const placed: { index: number; start: number; text: string }[] = [];
  if (count === 0) {
    return placed;
  }
  const widest = Math.max(1, ...labels.map((label) => label.length));
  const fits = Math.max(1, Math.floor((right - left) / (widest + 2)));
  const step = Math.max(1, Math.ceil(count / fits));
  // Centred under its datum, kept inside the frame.
  const startOf = (index: number) =>
    Math.round(centers[index] - (labels[index].length - 1) / 2);
  const candidates: number[] = [];
  for (let index = 0; index < count; index += step) {
    candidates.push(index);
  }
  if (candidates.at(-1) !== count - 1) {
    candidates.push(count - 1);
  }
  for (const index of candidates) {
    const text = labels[index];
    const start = clamp(
      startOf(index),
      left,
      Math.max(left, right - text.length)
    );
    if (index === count - 1) {
      // The last label wins over the ones that crowd it.
      while (placed.length > 1 && start <= labelEnd(placed.at(-1)) + 1) {
        placed.pop();
      }
    }
    if (start > labelEnd(placed.at(-1)) + 1) {
      placed.push({ index, start, text });
    }
  }
  return placed;
};

// ---------------------------------------------------------------------------
// Drawing a vertical chart
// ---------------------------------------------------------------------------

/** What a scrubbed or highlighted datum adds to the frame. */
interface DrawState {
  /** The scrubbed datum, or null. */
  active: number | null;
  /** The bar drawn solid while nothing is scrubbed. */
  highlight: number | null;
  /** Entrance progress, 0 to 1. */
  reveal: number;
  /** The spotlit series, drawn on top. */
  focus: number | null;
}

/** Everything a chart's look depends on. */
interface ChartLook {
  glyphs: ChartGlyphs;
  fill: ChartFill;
  curve: "smooth" | "linear";
  markers: "all" | "last" | "none";
  grid: boolean;
  /** Write the value over the highlighted bar. */
  barValues: boolean;
}

const drawAxes = ({
  frame,
  layout,
  labels,
  look,
  active,
}: {
  frame: GlyphFrame;
  layout: VerticalLayout;
  labels: readonly string[];
  look: ChartLook;
  active: number | null;
}) => {
  const { plot, scale, tickLabels, yOf, axisRow } = layout;
  const set = axisGlyphs(look.glyphs);
  const axisColumn = plot.left - 1;
  if (axisRow !== null) {
    for (let row = plot.top; row < axisRow; row += 1) {
      frame.put(axisColumn, row, set.v, INK.axis);
    }
    frame.put(axisColumn, axisRow, set.corner, INK.axis);
    for (let column = plot.left; column < frame.columns; column += 1) {
      frame.put(column, axisRow, set.h, INK.axis);
    }
  }
  for (const [index, tick] of scale.ticks.entries()) {
    const height = yOf(tick);
    const label = tickLabels[index];
    if (axisRow !== null && height <= 0.001) {
      frame.write(axisColumn - 1 - label.length, axisRow, label, INK.label);
      continue;
    }
    // Gridlines land on the exact sub-row (a quarter cell), in dots.
    const dotRow = clamp(
      Math.round((plot.rows - height) * 4 - 0.5),
      0,
      plot.rows * 4 - 1
    );
    const row = plot.top + Math.floor(dotRow / 4);
    if (look.grid) {
      const glyph =
        look.glyphs === "ascii"
          ? "."
          : brailleChar(BRAILLE_DOT_BITS[dotRow % 4][0]);
      for (
        let column = 0;
        column < plot.columns;
        column += look.glyphs === "ascii" ? 2 : 1
      ) {
        frame.put(plot.left + column, row, glyph, INK.grid);
      }
    }
    if (axisRow !== null) {
      frame.put(axisColumn, row, set.tick, INK.axis);
      frame.write(axisColumn - 1 - label.length, row, label, INK.label);
    }
  }
  if (axisRow === null) {
    return;
  }
  const centers = labels.map(
    (_, index) => plot.left + Math.floor(layout.xDot(index) / 2)
  );
  for (const { index, start, text } of placeLabels({
    centers,
    labels,
    left: 0,
    right: frame.columns,
  })) {
    frame.put(centers[index], axisRow, set.tickUp, INK.axis);
    frame.write(
      start,
      axisRow + 1,
      text,
      index === active ? INK.strong : INK.label
    );
  }
  if (active !== null) {
    frame.put(centers[active], axisRow, set.tickUp, INK.strong);
  }
};

/** A stretch of data with no gaps: one curve per array, over sub-columns `from` to `to`. */
interface Piece {
  curves: readonly ((x: number) => number)[];
  from: number;
  to: number;
}

type PiecesOf = (arrays: readonly (readonly number[])[]) => Piece[];

/**
 * Splits arrays into unbroken runs of finite values (a missing value is a
 * gap) and gives each run one curve per array, cut off at `reach`, where
 * the entrance sweep has got to.
 */
const makePieces =
  ({
    xs,
    yOf,
    smooth,
    reach,
  }: {
    xs: readonly number[];
    yOf: (value: number) => number;
    smooth: boolean;
    reach: number;
  }): PiecesOf =>
  (arrays) => {
    const pieces: Piece[] = [];
    const count = xs.length;
    let start = -1;
    for (let index = 0; index <= count; index += 1) {
      const finite =
        index < count &&
        arrays.every((values) => Number.isFinite(values[index]));
      if (finite && start < 0) {
        start = index;
      }
      if (!finite && start >= 0) {
        const at = xs.slice(start, index);
        const [from] = at;
        const to = Math.min(at.at(-1) ?? from, reach);
        if (from <= to) {
          const run = start;
          pieces.push({
            curves: arrays.map((values) =>
              interpolate(at, values.slice(run, index).map(yOf), smooth)
            ),
            from,
            to,
          });
        }
        start = -1;
      }
    }
    return pieces;
  };

/** One stretch of an area: a dot body under a dot edge, blocks, or ASCII. */
const drawAreaPiece = ({
  frame,
  dots,
  plot,
  look,
  series,
  piece,
}: {
  frame: GlyphFrame;
  dots: DotGrid | null;
  plot: PlotBox;
  look: ChartLook;
  series: PlotSeries;
  piece: Piece;
}) => {
  const span = plot.rows * 0.7;
  const ink = seriesInk(series.index);
  const [top, bottom] = piece.curves;
  const { from, to } = piece;
  if (dots !== null) {
    // Edge as a line, body as ordered dithering on the dots below it.
    for (let x = Math.round(from); x <= Math.round(to); x += 1) {
      const edge = heightToDot(dots, top(x));
      const last =
        bottom(x) <= 0 ? dots.height - 1 : heightToDot(dots, bottom(x)) - 1;
      for (let y = edge; y <= last; y += 1) {
        const tone = bodyTone({
          depth: (y - edge) / dots.gy,
          fill: look.fill,
          index: series.index,
          span,
        });
        if (y === edge || isInked("bayer4", x, y, tone)) {
          setDot(dots, x, y, ink);
        }
      }
    }
    rasterCurve({ curve: top, dashed: false, from, grid: dots, ink, to });
    return;
  }
  const glyphs = look.glyphs === "ascii" ? "ascii" : "blocks";
  for (
    let column = Math.ceil((from - 0.5) / 2);
    column <= Math.floor((to + 0.5) / 2);
    column += 1
  ) {
    const center = clamp(column * 2 + 0.5, from, to);
    const high = clamp(top(center), 0, plot.rows);
    const low = clamp(bottom(center), 0, plot.rows);
    const x = plot.left + column;
    // Body cells up to the edge, eighths on top (whole cells in ASCII).
    // The bottom cell may hold the edge of the layer below; the body
    // tucks under it.
    const whole = glyphs === "ascii" ? Math.round(high) : Math.floor(high);
    const start = Math.floor(low + 0.01);
    for (let row = start; row < whole; row += 1) {
      frame.fill(
        x,
        plot.rowAt(row),
        bodyGlyph({
          depth: high - row - 1,
          fill: look.fill,
          glyphs,
          index: series.index,
          span,
        }),
        ink
      );
    }
    const eighths = Math.round((high - whole) * 8);
    if (glyphs === "blocks" && eighths > 0 && whole >= start) {
      frame.cap(x, plot.rowAt(whole), EIGHTHS_UP[eighths], ink);
    }
  }
  if (glyphs === "ascii") {
    asciiCurve({ curve: top, dashed: false, frame, from, ink, plot, to });
  }
};

/** Areas: eighth-block edges over a fading body, or dots, or ASCII. */
const drawAreas = ({
  frame,
  dots,
  layout,
  areas,
  look,
  piecesOf,
}: {
  frame: GlyphFrame;
  dots: DotGrid | null;
  layout: VerticalLayout;
  areas: readonly PlotSeries[];
  look: ChartLook;
  piecesOf: PiecesOf;
}) => {
  for (const series of areas) {
    for (const piece of piecesOf([series.high, series.low])) {
      drawAreaPiece({ dots, frame, look, piece, plot: layout.plot, series });
    }
  }
};

/** A glyph that fills `share` of a cell from the top: an eighth, a half or whole. */
const hangingCap = (share: number) => {
  if (share < 0.3) {
    return "▔";
  }
  return share < 0.75 ? "▀" : "█";
};

/**
 * The glyph in each row of a bar (rows counted from the plot bottom), in
 * blocks or ASCII. Bars end in an eighth block, so their height is exact
 * to an eighth of a cell; hanging (negative) bars end in the nearest
 * glyph that fills a cell from the top.
 */
const barCells = ({
  bottom,
  top,
  negative,
  glyphs,
  fill,
  index,
  span,
}: {
  bottom: number;
  top: number;
  negative: boolean;
  glyphs: "blocks" | "ascii";
  fill: ChartFill;
  index: number;
  span: number;
}) => {
  const cells: { row: number; glyph: string; cap: boolean }[] = [];
  const body = (depth: number) =>
    bodyGlyph({ depth, fill, glyphs, index, span });
  if (glyphs === "ascii") {
    const from = Math.round(bottom);
    const to = Math.round(top);
    for (let row = from; row < to; row += 1) {
      cells.push({
        cap: false,
        glyph: body(negative ? row - from : to - row - 1),
        row,
      });
    }
    return cells;
  }
  if (negative) {
    const whole = Math.ceil(top - 0.001);
    const from = Math.floor(bottom);
    for (let row = from + 1; row < whole; row += 1) {
      cells.push({ cap: false, glyph: body(whole - 1 - row), row });
    }
    const rest = from + 1 - bottom;
    if (from < whole && rest > 0.05) {
      cells.push({ cap: true, glyph: hangingCap(rest), row: from });
    }
    return cells;
  }
  const whole = Math.floor(top);
  // The bottom cell may hold the end of the segment below; the body
  // tucks under it.
  const start = Math.floor(bottom + 0.01);
  for (let row = start; row < whole; row += 1) {
    cells.push({ cap: false, glyph: body(top - row - 1), row });
  }
  const eighths = Math.round((top - whole) * 8);
  if (eighths > 0 && whole >= start) {
    cells.push({ cap: true, glyph: EIGHTHS_UP[eighths], row: whole });
  }
  return cells;
};

interface BarShape {
  left: number;
  width: number;
  low: number;
  high: number;
  ink: number;
  index: number;
  solid: boolean;
}

/** A bar as ordered dithering on the dot grid, densest at its end. */
const drawBarDots = (
  dots: DotGrid,
  plot: PlotBox,
  { left, width, low, high, ink, index, fill }: BarShape & { fill: ChartFill }
) => {
  const span = plot.rows * 0.75;
  const bottom = clamp(Math.min(low, high), 0, plot.rows);
  const top = clamp(Math.max(low, high), 0, plot.rows);
  // Dots whose centres fall between the bar's bottom and top.
  const edge = Math.max(0, Math.ceil((plot.rows - top) * dots.gy - 0.5));
  const floor = Math.min(
    dots.height - 1,
    Math.floor((plot.rows - bottom) * dots.gy - 0.5)
  );
  for (let x = left * 2; x < (left + width) * 2; x += 1) {
    for (let y = edge; y <= floor; y += 1) {
      const depth = (high < low ? floor - y : y - edge) / dots.gy;
      if (isInked("bayer4", x, y, bodyTone({ depth, fill, index, span }))) {
        setDot(dots, x, y, ink);
      }
    }
  }
};

/** Draw one vertical bar into the frame, or the dot grid for Braille. */
const drawBar = ({
  frame,
  dots,
  plot,
  look,
  bar,
}: {
  frame: GlyphFrame;
  dots: DotGrid | null;
  plot: PlotBox;
  look: ChartLook;
  bar: BarShape;
}) => {
  const fill: ChartFill = bar.solid ? "solid" : look.fill;
  if (dots !== null || look.glyphs === "braille") {
    if (dots !== null) {
      drawBarDots(dots, plot, { ...bar, fill });
    }
    return;
  }
  const cells = barCells({
    bottom: clamp(Math.min(bar.low, bar.high), 0, plot.rows),
    fill,
    glyphs: look.glyphs,
    index: bar.index,
    negative: bar.high < bar.low,
    span: plot.rows * 0.75,
    top: clamp(Math.max(bar.low, bar.high), 0, plot.rows),
  });
  for (const { row, glyph, cap } of cells) {
    for (let column = 0; column < bar.width; column += 1) {
      const at = plot.left + bar.left + column;
      if (cap) {
        frame.cap(at, plot.rowAt(row), glyph, bar.ink);
      } else {
        frame.fill(at, plot.rowAt(row), glyph, bar.ink);
      }
    }
  }
};

/** Widest bar, in cells, so wide charts keep air between bars. */
const MAX_BAR = 8;

/** Where each bar of datum `index` sits: start column and width in plot cells. */
const barSlots = ({
  layout,
  index,
  bars,
  stacked,
}: {
  layout: VerticalLayout;
  index: number;
  bars: number;
  stacked: boolean;
}) => {
  const [start, end] = layout.band(index);
  const room = end - start;
  // Leave a cell between neighbouring bands when the band can spare it.
  const usable = room > 2 ? room - 1 : room;
  if (stacked || bars <= 1) {
    const width = clamp(Math.round(usable * (room > 3 ? 0.75 : 1)), 1, MAX_BAR);
    const left = start + Math.floor((room - width) / 2);
    return Array.from({ length: Math.max(1, bars) }, () => ({ left, width }));
  }
  const width = clamp(Math.floor(usable / bars), 1, MAX_BAR);
  const group = width * bars;
  const left = start + Math.floor((room - group) / 2);
  return Array.from({ length: bars }, (_, slot) => ({
    left: left + slot * width,
    width,
  }));
};

/** Bars grow from the baseline one after another on entrance. */
const barGrowth = (reveal: number, index: number, count: number) => {
  if (reveal >= 1) {
    return 1;
  }
  const delay = count > 1 ? (index / (count - 1)) * 0.35 : 0;
  const linear = clamp((reveal - delay) / 0.65, 0, 1);
  return 1 - (1 - linear) ** 2;
};

const drawBars = ({
  frame,
  dots,
  layout,
  bars,
  look,
  state,
  stacked,
  count,
  formatValue,
}: {
  frame: GlyphFrame;
  dots: DotGrid | null;
  layout: VerticalLayout;
  bars: readonly PlotSeries[];
  look: ChartLook;
  state: DrawState;
  stacked: boolean;
  count: number;
  formatValue: (value: number) => string;
}) => {
  const { plot, yOf } = layout;
  const zero = clamp(yOf(0), 0, plot.rows);
  const solidAt = state.active ?? state.highlight;
  for (let datum = 0; datum < count; datum += 1) {
    const growth = barGrowth(state.reveal, datum, count);
    const slots = barSlots({
      bars: bars.length,
      index: datum,
      layout,
      stacked,
    });
    for (const [slot, series] of bars.entries()) {
      if (!Number.isFinite(series.high[datum])) {
        continue;
      }
      const { left, width } = slots[slot];
      const low = stacked ? yOf(series.low[datum]) : zero;
      const high = yOf(series.high[datum]);
      drawBar({
        bar: {
          high: zero + (high - zero) * growth,
          index: series.index,
          ink: seriesInk(series.index),
          left,
          low: zero + (low - zero) * growth,
          solid: datum === solidAt,
          width,
        },
        dots,
        frame,
        look,
        plot,
      });
    }
  }
  if (
    !look.barValues ||
    state.highlight === null ||
    state.reveal < 1 ||
    bars.length === 0
  ) {
    return;
  }
  // The value over the highlighted bar: the stack's total or the tallest.
  const datum = state.highlight;
  const values = bars.map((series) =>
    stacked ? series.high[datum] : positive(series.raw[datum])
  );
  const peak = Math.max(...values);
  const text = formatValue(peak);
  const [start, end] = layout.band(datum);
  const center = plot.left + Math.floor((start + end - 1) / 2);
  const row = plot.rowAt(
    Math.min(plot.rows, Math.floor(clamp(yOf(peak), 0, plot.rows) - 0.001) + 1)
  );
  frame.write(
    clamp(
      center - Math.floor((text.length - 1) / 2),
      0,
      frame.columns - text.length
    ),
    Math.max(0, row),
    text,
    INK.strong
  );
};

const drawLines = ({
  frame,
  dots,
  layout,
  lines,
  piecesOf,
}: {
  frame: GlyphFrame;
  dots: DotGrid | null;
  layout: VerticalLayout;
  lines: readonly PlotSeries[];
  piecesOf: PiecesOf;
}) => {
  for (const series of lines) {
    const ink = seriesInk(series.index);
    for (const { curves, from, to } of piecesOf([series.high])) {
      const [curve] = curves;
      if (dots === null) {
        asciiCurve({
          curve,
          dashed: series.dashed,
          frame,
          from,
          ink,
          plot: layout.plot,
          to,
        });
      } else {
        rasterCurve({
          curve,
          dashed: series.dashed,
          from,
          grid: dots,
          ink,
          to,
        });
      }
    }
  }
};

/** Range bands: sparse dots (or shades) between each line's low and high. */
const drawRanges = ({
  frame,
  dots,
  layout,
  lines,
  look,
  piecesOf,
}: {
  frame: GlyphFrame;
  dots: DotGrid | null;
  layout: VerticalLayout;
  lines: readonly PlotSeries[];
  look: ChartLook;
  piecesOf: PiecesOf;
}) => {
  const { plot } = layout;
  const glyph = look.glyphs === "ascii" ? "." : "░";
  for (const series of lines) {
    const ink = bandInk(series.index);
    const pieces =
      series.range === null
        ? []
        : piecesOf([series.range.low, series.range.high]);
    for (const { curves, from, to } of pieces) {
      const [low, high] = curves;
      if (dots !== null) {
        for (let x = Math.round(from); x <= Math.round(to); x += 1) {
          for (
            let y = heightToDot(dots, high(x));
            y <= heightToDot(dots, low(x));
            y += 1
          ) {
            if (isInked("bayer4", x, y, 0.22)) {
              setDot(dots, x, y, ink);
            }
          }
        }
        continue;
      }
      for (
        let column = Math.ceil(from / 2);
        column <= Math.floor(to / 2);
        column += 1
      ) {
        const center = column * 2 + 0.5;
        for (
          let row = Math.round(low(center));
          row < Math.round(high(center));
          row += 1
        ) {
          if (row >= 0 && row < plot.rows) {
            frame.put(plot.left + column, plot.rowAt(row), glyph, ink);
          }
        }
      }
    }
  }
};

/** Point markers, the cursor column and the markers on the scrubbed datum. */
const drawMarkers = ({
  frame,
  layout,
  series,
  look,
  state,
}: {
  frame: GlyphFrame;
  layout: VerticalLayout;
  series: readonly PlotSeries[];
  look: ChartLook;
  state: DrawState;
}) => {
  const { plot, xDot, yOf } = layout;
  const cellOf = (datum: number, value: number) => ({
    column: plot.left + Math.floor(xDot(datum) / 2),
    row: plot.rowAt(clamp(Math.floor(yOf(value)), 0, plot.rows - 1)),
  });
  const marked = series.filter((entry) => entry.type !== "bar");
  if (state.reveal >= 1 && look.markers !== "none") {
    for (const entry of marked) {
      const glyph = markerOf(look.glyphs, entry.index);
      const finite = entry.high.flatMap((value, datum) =>
        Number.isFinite(value) ? [datum] : []
      );
      for (const datum of look.markers === "all" ? finite : finite.slice(-1)) {
        const { column, row } = cellOf(datum, entry.high[datum]);
        frame.mark(column, row, glyph, seriesInk(entry.index));
      }
    }
  }
  if (state.active === null) {
    return;
  }
  const column = plot.left + Math.floor(xDot(state.active) / 2);
  if (marked.length > 0) {
    const bar = look.glyphs === "ascii" ? "|" : "│";
    for (let row = plot.top; row < plot.top + plot.rows; row += 1) {
      if (
        frame.blank(column, row) ||
        frame.inks[row * frame.columns + column] === INK.grid
      ) {
        frame.put(column, row, bar, INK.cursor);
      }
    }
  }
  for (const entry of marked.filter((item) =>
    Number.isFinite(item.high[state.active ?? 0])
  )) {
    const { row } = cellOf(state.active, entry.high[state.active]);
    frame.mark(
      column,
      row,
      markerOf(look.glyphs, entry.index),
      seriesInk(entry.index)
    );
  }
};

/** The full frame for a vertical chart. */
const drawVertical = ({
  columns,
  rows,
  layout,
  series,
  labels,
  look,
  state,
  stack,
  formatValue,
}: {
  columns: number;
  rows: number;
  layout: VerticalLayout;
  series: readonly PlotSeries[];
  labels: readonly string[];
  look: ChartLook;
  state: DrawState;
  stack: ChartStack;
  formatValue: (value: number) => string;
}) => {
  const frame = new GlyphFrame(columns, rows);
  const { plot } = layout;
  const count = labels.length;
  drawAxes({ active: state.active, frame, labels, layout, look });
  if (count === 0) {
    return frame;
  }
  // The spotlit series draws last, on top of the others.
  const ordered =
    state.focus === null
      ? series
      : [
          ...series.filter((entry) => entry.index !== state.focus),
          ...series.filter((entry) => entry.index === state.focus),
        ];
  const rank = new Map(
    ordered.map((entry, position) => [seriesInk(entry.index), position])
  );
  const rankOf = (ink: number) => rank.get(ink) ?? -1;
  const xs = labels.map((_, index) => layout.xDot(index));
  const first = xs[0] ?? 0;
  const piecesOf = makePieces({
    reach: first + ((xs.at(-1) ?? 0) - first) * state.reveal,
    smooth: look.curve === "smooth",
    xs,
    yOf: layout.yOf,
  });
  const dotKind = look.glyphs === "braille" ? "braille" : "quadrants";
  const fills =
    look.glyphs === "braille"
      ? createDots("braille", plot.columns, plot.rows)
      : null;
  const lineDots =
    look.glyphs === "ascii"
      ? null
      : createDots(dotKind, plot.columns, plot.rows);

  const areas = ordered.filter((entry) => entry.type === "area");
  const lines = ordered.filter((entry) => entry.type === "line");
  drawRanges({ dots: fills, frame, layout, lines, look, piecesOf });
  drawAreas({ areas, dots: fills, frame, layout, look, piecesOf });
  drawBars({
    bars: series.filter((entry) => entry.type === "bar"),
    count,
    dots: fills,
    formatValue,
    frame,
    layout,
    look,
    stacked: stack !== "none",
    state,
  });
  if (fills !== null) {
    composeDots(fills, frame, { left: plot.left, rank: rankOf, top: plot.top });
  }
  drawLines({ dots: lineDots, frame, layout, lines, piecesOf });
  if (lineDots !== null) {
    composeDots(lineDots, frame, {
      left: plot.left,
      rank: rankOf,
      top: plot.top,
    });
  }
  drawMarkers({ frame, layout, look, series: ordered, state });
  return frame;
};

// ---------------------------------------------------------------------------
// Drawing horizontal bars
// ---------------------------------------------------------------------------

interface HorizontalLayout {
  left: number;
  columns: number;
  scale: Scale;
  /** Rows per datum, gap included. */
  pitch: number;
  lanes: number;
  xOf: (value: number) => number;
  indexAt: (row: number) => number;
  rowOf: (index: number) => number;
}

const layoutHorizontal = ({
  columns,
  labels,
  values,
  bars,
  stacked,
  percent,
  formatValue,
}: {
  columns: number;
  labels: readonly string[];
  values: readonly number[];
  bars: number;
  stacked: boolean;
  percent: boolean;
  formatValue: (value: number) => string;
}): HorizontalLayout => {
  const scale = percent ? PERCENT_SCALE : niceScale(values, { zero: true });
  const left = Math.max(1, ...labels.map((label) => label.length)) + 2;
  const valueRoom =
    Math.max(1, ...values.map((value) => formatValue(value).length)) + 1;
  const plotColumns = Math.max(4, columns - left - valueRoom);
  const lanes = stacked ? 1 : Math.max(1, bars);
  const pitch = lanes + 1;
  const max = Math.max(scale.max, 1e-9);
  return {
    columns: plotColumns,
    indexAt: (row) =>
      clamp(Math.floor(row / pitch), 0, Math.max(0, labels.length - 1)),
    lanes,
    left,
    pitch,
    rowOf: (index) => index * pitch,
    scale,
    xOf: (value) => (Math.max(0, value) / max) * plotColumns,
  };
};

/** The partial cell at the end of a horizontal bar, `eighths` of it filled. */
const rowCap = (glyphs: ChartGlyphs, eighths: number) => {
  if (glyphs === "ascii") {
    return eighths >= 4 ? "#" : " ";
  }
  if (glyphs === "braille") {
    // A part cell fills the left column of dots (71), or all eight (255).
    return brailleChar(eighths >= 4 ? 255 : 71);
  }
  return EIGHTHS_RIGHT[eighths];
};

/** One horizontal bar from `from` to `to` cells, ending in an eighth block. */
const drawRowBar = (
  frame: GlyphFrame,
  layout: HorizontalLayout,
  {
    row,
    from,
    to,
    index,
    fill,
    glyphs,
  }: {
    row: number;
    from: number;
    to: number;
    index: number;
    fill: ChartFill;
    glyphs: ChartGlyphs;
  }
) => {
  const span = layout.columns * 0.75;
  const whole = Math.floor(to);
  const start = Math.floor(from + 0.01);
  const ink = seriesInk(index);
  for (let column = start; column < whole; column += 1) {
    const depth = to - column - 1;
    const glyph =
      glyphs === "braille"
        ? brailleChar(
            orderedMask(column, row, bodyTone({ depth, fill, index, span }))
          )
        : bodyGlyph({ depth, fill, glyphs, index, span });
    frame.fill(layout.left + column, row, glyph, ink);
  }
  const eighths = Math.round((to - whole) * 8);
  if (eighths > 0 && whole >= start) {
    frame.cap(layout.left + whole, row, rowCap(glyphs, eighths), ink);
  }
};

const drawHorizontal = ({
  columns,
  layout,
  series,
  labels,
  look,
  state,
  stacked,
  formatValue,
}: {
  columns: number;
  layout: HorizontalLayout;
  series: readonly PlotSeries[];
  labels: readonly string[];
  look: ChartLook;
  state: DrawState;
  stacked: boolean;
  formatValue: (value: number) => string;
}) => {
  const count = labels.length;
  const rows = Math.max(1, count * layout.pitch - 1);
  const frame = new GlyphFrame(columns, rows);
  const axis = axisGlyphs(look.glyphs);
  const solidAt = state.active ?? state.highlight;
  for (const [datum, label] of labels.entries()) {
    const top = layout.rowOf(datum);
    const strong = datum === state.active;
    frame.write(
      layout.left - 2 - label.length,
      top + Math.floor((layout.lanes - 1) / 2),
      label,
      strong ? INK.strong : INK.label
    );
    for (let lane = 0; lane < layout.lanes; lane += 1) {
      frame.put(
        layout.left - 1,
        top + lane,
        lane === 0 ? axis.tick : axis.v,
        INK.axis
      );
    }
    if (layout.pitch > layout.lanes && datum < count - 1) {
      frame.put(layout.left - 1, top + layout.lanes, axis.v, INK.axis);
    }
    const growth = barGrowth(state.reveal, datum, count);
    let end = 0;
    for (const [slot, entry] of series.entries()) {
      const row = top + (stacked ? 0 : slot);
      const from = stacked ? layout.xOf(entry.low[datum]) * growth : 0;
      const to = layout.xOf(entry.high[datum]) * growth;
      end = Math.max(end, to);
      drawRowBar(frame, layout, {
        fill: datum === solidAt ? "solid" : look.fill,
        from,
        glyphs: look.glyphs,
        index: entry.index,
        row,
        to,
      });
      if (!stacked && state.reveal >= 1) {
        const text = Number.isFinite(entry.raw[datum])
          ? formatValue(entry.raw[datum])
          : "";
        frame.write(
          layout.left + Math.ceil(to) + 1,
          row,
          text,
          strong ? INK.strong : INK.label
        );
      }
    }
    if (stacked && state.reveal >= 1) {
      const total = series.reduce(
        (sum, entry) => sum + positive(entry.raw[datum]),
        0
      );
      frame.write(
        layout.left + Math.ceil(end) + 1,
        top,
        formatValue(total),
        strong ? INK.strong : INK.label
      );
    }
  }
  return frame;
};

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

/** The scrubbed datum and whether the scrub is showing. */
interface Scrub {
  index: number;
  visible: boolean;
}

const hide = (current: Scrub | null): Scrub | null =>
  current === null ? null : { ...current, visible: false };

/**
 * The scrub state and its handlers: pointer moves throttled to one update
 * per frame, keys that step through the data, and Escape to let go.
 */
const useScrub = ({
  count,
  indexAt,
  onEscape,
  upDown,
}: {
  count: number;
  indexAt: (x: number, y: number) => number | null;
  onEscape: () => void;
  /** Step with the up and down arrows (horizontal bars) instead of left and right. */
  upDown: boolean;
}) => {
  const [scrub, setScrub] = useState<Scrub | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (count === 0) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    };
    if (frame.current !== 0) {
      return;
    }
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (pointer.current === null) {
        return;
      }
      const index = indexAt(pointer.current.x, pointer.current.y);
      setScrub((current) => {
        if (index === null) {
          return hide(current);
        }
        return current?.index === index && current.visible
          ? current
          : { index, visible: true };
      });
    });
  };

  const onPointerLeave = () => {
    pointer.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    setScrub(hide);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setScrub(hide);
      onEscape();
      return;
    }
    if (count === 0) {
      return;
    }
    const current = scrub?.index ?? (upDown ? 0 : count - 1);
    const page = Math.max(1, Math.round(count / 10));
    const back = upDown ? "ArrowUp" : "ArrowLeft";
    const forward = upDown ? "ArrowDown" : "ArrowRight";
    const targets: Readonly<Record<string, number>> = {
      [back]: current - 1,
      [forward]: current + 1,
      End: count - 1,
      Home: 0,
      PageDown: current + page,
      PageUp: current - page,
    };
    const target = targets[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    // The page may bind the arrows too (docs prev/next); the chart owns them while focused.
    event.stopPropagation();
    setScrub({ index: clamp(target, 0, count - 1), visible: true });
  };

  const onFocus = () =>
    setScrub((current) =>
      current?.visible === true
        ? current
        : { index: current?.index ?? (upDown ? 0 : count - 1), visible: true }
    );

  return {
    handlers: {
      onBlur: () => setScrub(hide),
      onFocus,
      onKeyDown,
      onPointerLeave,
      onPointerMove,
    },
    scrub,
  };
};

export interface ReadoutRow {
  label: string;
  color: AsciiColor;
  /** The series' glyph key. */
  key: string;
  value: string;
}

/** Gap between the readout and what it describes, in px. */
const READOUT_GAP = 10;

/**
 * Places the readout beside its anchor, flipping to the other side when
 * it would leave the chart. Writes the transform straight to the element
 * so a scrub never re-lays out React.
 */
const useReadoutPosition = (
  ref: RefObject<HTMLDivElement | null>,
  anchor: { x: number; y: number; width: number; height: number } | null
) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || anchor === null) {
      return;
    }
    const { offsetWidth: w, offsetHeight: h } = el;
    const right = anchor.x + READOUT_GAP;
    const left = right + w <= anchor.width ? right : anchor.x - READOUT_GAP - w;
    const top = clamp(anchor.y, 0, Math.max(0, anchor.height - h));
    el.style.transform = `translate3d(${Math.round(Math.max(0, left))}px, ${Math.round(top)}px, 0)`;
  });
};

/** The readout: the category, then one row per series, terminal style. */
const Readout = ({
  ref,
  row: { label, values } = { label: "", values: [] },
  visible,
  focus,
}: {
  ref: RefObject<HTMLDivElement | null>;
  row: { label: string; values: readonly ReadoutRow[] } | undefined;
  visible: boolean;
  focus: number | null;
}) => (
  <div
    ref={ref}
    aria-hidden="true"
    className="bg-popover/95 text-popover-foreground border-border pointer-events-none absolute top-0 left-0 z-10 min-w-36 border font-mono text-[11px] leading-4 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm transition-opacity duration-150 ease-out motion-reduce:transition-none"
    style={{ opacity: visible ? 1 : 0 }}
  >
    <div className="border-border text-muted-foreground border-b px-2 py-1 tracking-wide uppercase">
      {label}
    </div>
    <div className="flex flex-col gap-0.5 px-2 py-1.5">
      {values.map((row, index) => (
        <div
          key={row.label}
          className={cn(
            "flex items-center gap-2 transition-opacity duration-150",
            focus !== null && focus !== index && "opacity-40"
          )}
        >
          <GlyphSwatch glyphs={row.key} color={cssColor(row.color)} />
          <span className="text-muted-foreground pr-3">{row.label}</span>
          <span className="ml-auto font-medium tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Legend entries. Interactive ones are toggle buttons: hover or focus
 * spotlights a series, click locks it, Escape lets go.
 */
const Legend = ({
  entries,
  interactive,
  focus,
  locked,
  onHover,
  onLock,
}: {
  entries: readonly { label: string; key: string; color: AsciiColor }[];
  interactive: boolean;
  focus: number | null;
  locked: number | null;
  onHover: (index: number | null) => void;
  onLock: (index: number | null) => void;
}) => (
  <div
    className="mt-2 flex flex-wrap gap-1"
    {...(interactive
      ? { "aria-label": "Series", role: "group" }
      : { "aria-hidden": true })}
  >
    {entries.map((entry, index) => {
      const content = (
        <>
          <GlyphSwatch glyphs={entry.key} color={cssColor(entry.color)} />
          {entry.label}
        </>
      );
      const itemClass = cn(
        "text-muted-foreground inline-flex h-7 items-center gap-1.5 px-2 font-mono text-[11px] transition-[color,opacity,background-color] duration-150 ease-out",
        focus !== null && focus !== index && "opacity-45"
      );
      if (!interactive) {
        return (
          <span key={entry.label} className={itemClass}>
            {content}
          </span>
        );
      }
      return (
        <button
          key={entry.label}
          type="button"
          aria-pressed={locked === index}
          aria-label={`Spotlight ${entry.label}`}
          onPointerEnter={() => onHover(index)}
          onPointerLeave={() => onHover(null)}
          onFocus={() => onHover(index)}
          onBlur={() => onHover(null)}
          onClick={() => onLock(locked === index ? null : index)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onLock(null);
            }
          }}
          className={cn(
            itemClass,
            "hover:text-foreground focus-visible:ring-ring/60 aria-pressed:bg-muted aria-pressed:text-foreground cursor-pointer rounded-sm outline-none focus-visible:ring-2"
          )}
        >
          {content}
        </button>
      );
    })}
  </div>
);

/** Every value, for screen readers. */
const DataTable = ({
  summary,
  series,
  rows,
}: {
  summary: string;
  series: readonly { label: string }[];
  rows: readonly { label: string; values: readonly ReadoutRow[] }[];
}) => (
  <table className="sr-only">
    <caption>{summary}</caption>
    <thead>
      <tr>
        <th scope="col">Category</th>
        {series.map((entry) => (
          <th key={entry.label} scope="col">
            {entry.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- categories can repeat; position is the identity.
        <tr key={index}>
          <th scope="row">{row.label}</th>
          {row.values.map((value) => (
            <td key={value.label}>{value.value}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

/** The visually hidden key help and the live readout for screen readers. */
const ScreenReaderStatus = ({
  id,
  text,
  upDown,
}: {
  id: string;
  text: string;
  upDown: boolean;
}) => (
  <>
    <p id={id} className="sr-only">
      Use the {upDown ? "up and down" : "left and right"} arrow keys to move
      through the data, Home and End to jump to the ends, Escape to clear.
    </p>
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  </>
);

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

/** Props every cartesian chart shares. */
export interface ChartStyleProps {
  /**
   * The glyph family: `braille` dot-matrix lines and fills, `blocks`
   * (eighth blocks, shades and quadrant lines) or plain `ascii`.
   */
  glyphs?: ChartGlyphs;
  /**
   * How area and bar bodies fill: `gradient` fades away from the edge,
   * `solid` is a full block, `pattern` gives each series its own texture.
   */
  fill?: ChartFill;
  /** Colours by series position, as palette names or CSS colours. A series' own `color` wins. */
  colors?: readonly AsciiColor[];
  /** Glyph cell height in px. Default `--ascii-cell` (12). */
  cell?: number;
  /** Height in px, axes included. Default 240. */
  height?: number;
  /** Show the value and category axes. Default true. */
  axes?: boolean;
  /** Dotted gridlines at each value tick. Default true. */
  grid?: boolean;
  /** Show the readout while scrubbing. Default true. */
  tooltip?: boolean;
  /** Show the legend. Default: when there are two or more series. */
  legend?: boolean;
  /** Hover, keyboard scrubbing, readout and legend spotlight. `false` for decorative charts. Default true. */
  interactive?: boolean;
  /** Entrance motion: lines sweep in, bars grow. Default true; always off under reduced motion. */
  animate?: boolean;
  /** A soft glow in each series' colour, scaled by `--ascii-glow`. Default false. */
  glow?: boolean;
  /**
   * How values are written on the axis, in the readout and in the table:
   * `Intl.NumberFormat` options or a function. Default compact (1.2K).
   */
  format?: ValueFormat;
}

export interface CartesianChartProps<T>
  extends Omit<ComponentProps<"div">, "children">, ChartStyleProps {
  /** One entry per point (or bar) along the x axis, in order. */
  data: readonly T[];
  /** Key (or function) for each datum's category label. */
  x: Accessor<T, string | number>;
  /** One or more series, each a `line`, `area` or `bar`. Later series draw on top. */
  series: NonEmpty<CartesianSeries<T>>;
  /**
   * How areas (with areas) and bars (with bars) combine. `none`: overlap,
   * or bars side by side. `stacked`: each sits on the ones before it.
   * `percent`: stacked and scaled to 100%. Default `none`.
   */
  stack?: ChartStack;
  /** `smooth` (monotone, never overshoots) or `linear`. Default `smooth`. */
  curve?: "smooth" | "linear";
  /** Markers on lines and areas: on every point, the `last`, or `none`. Default `last`. */
  markers?: "all" | "last" | "none";
  /** Start the value axis at zero. Default: true when there are bars or areas. */
  zero?: boolean;
  /**
   * The bar drawn solid while nothing is scrubbed: an index, the `last`,
   * the `max`, or `none`. Default `last`.
   */
  highlight?: number | "last" | "max" | "none";
  /**
   * `vertical`, or `horizontal` for bars that grow to the right with their
   * labels on the left. Horizontal charts draw bar series only. Default `vertical`.
   */
  orientation?: "vertical" | "horizontal";
  /** Short description of the chart, read before the data table. Default: built from the series. */
  summary?: string;
}

const resolveHighlight = (
  highlight: NonNullable<CartesianChartProps<unknown>["highlight"]>,
  totals: readonly number[]
): number | null => {
  if (totals.length === 0 || highlight === "none") {
    return null;
  }
  if (highlight === "last") {
    return totals.length - 1;
  }
  if (highlight === "max") {
    return totals.indexOf(Math.max(...totals));
  }
  return highlight >= 0 && highlight < totals.length ? highlight : null;
};

/** The key glyphs for a series in the legend and readout. */
const seriesKey = (
  type: CartesianSeries<unknown>["type"],
  glyphs: ChartGlyphs,
  fill: ChartFill,
  index: number,
  dashed: boolean
) => {
  if (type === "line") {
    const marker = markerOf(glyphs, index);
    if (glyphs === "ascii") {
      return dashed ? `- ${marker}` : `--${marker}`;
    }
    return dashed ? `╌${marker}` : `─${marker}`;
  }
  if (glyphs === "braille") {
    return type === "area" ? "⣠⣿" : "⣿⣿";
  }
  const body = bodyGlyph({
    depth: 0,
    fill: fill === "pattern" ? "pattern" : "solid",
    glyphs,
    index,
    span: 1,
  });
  if (type === "area") {
    return glyphs === "ascii" ? `_${body}` : `▅${body}`;
  }
  return `${body}${body}`;
};

/** "Line chart", "Stacked area chart", "Bar chart". */
const chartKind = (series: readonly PlotSeries[], stack: ChartStack) => {
  let kind = "line";
  if (series.some((entry) => entry.type === "bar")) {
    kind = "bar";
  } else if (series.some((entry) => entry.type === "area")) {
    kind = "area";
  }
  return stack === "none"
    ? `${kind[0].toUpperCase()}${kind.slice(1)} chart`
    : `Stacked ${kind} chart`;
};

/** How each ink paints, with spotlight dimming and glow. */
const usePaint = ({
  series,
  focus,
  glow,
}: {
  series: readonly PlotSeries[];
  focus: number | null;
  glow: boolean;
}) =>
  useCallback(
    (ink: number): InkPaint | undefined => {
      const furniture = FURNITURE[ink];
      if (furniture !== undefined) {
        return furniture;
      }
      const band = ink >= FIRST_BAND_INK;
      const entry =
        series[band ? ink - FIRST_BAND_INK : ink - FIRST_SERIES_INK];
      if (entry === undefined) {
        return undefined;
      }
      const color = cssColor(entry.color);
      return {
        color: band
          ? `color-mix(in oklab, ${color} 50%, var(--ascii-paper))`
          : color,
        glow: glow && !band,
        opacity: focus === null || focus === entry.index ? 1 : 0.22,
      };
    },
    [series, focus, glow]
  );

interface ModelInput<T> {
  data: readonly T[];
  x: Accessor<T, string | number>;
  series: readonly CartesianSeries<T>[];
  stack: ChartStack;
  colors: readonly AsciiColor[];
  horizontal: boolean;
  fill: ChartFill | undefined;
  glyphs: ChartGlyphs;
  format: ValueFormat | undefined;
  highlight: NonNullable<CartesianChartProps<T>["highlight"]>;
  zero: boolean | undefined;
  axes: boolean;
  columns: number;
  rows: number;
}

/** Series, layout and table rows: everything but the drawing. */
const useChartModel = <T,>({
  data,
  x,
  series,
  stack,
  colors,
  horizontal,
  fill,
  glyphs,
  format,
  highlight,
  zero,
  axes,
  columns,
  rows,
}: ModelInput<T>) => {
  const formatValue = useMemo(() => toFormatter(format), [format]);
  const percent = stack === "percent";
  const plotted = useMemo(
    () =>
      prepareSeries({
        colors,
        data,
        series: horizontal
          ? series.filter((entry) => entry.type === "bar")
          : series,
        stack,
      }),
    [colors, data, series, stack, horizontal]
  );
  const labels = useMemo(
    () => data.map((datum) => readLabel(datum, x)),
    [data, x]
  );
  const bars = plotted.filter((entry) => entry.type === "bar");
  const fillMode: ChartFill =
    fill ?? (bars.length > 1 ? "pattern" : "gradient");
  const totals = data.map((_, index) =>
    bars.reduce((sum, entry) => sum + positive(entry.raw[index]), 0)
  );
  const values = useMemo(
    () =>
      plotted.flatMap((entry) => [
        ...entry.high,
        ...entry.low,
        ...(entry.range === null
          ? []
          : [...entry.range.low, ...entry.range.high]),
      ]),
    [plotted]
  );
  const hasBars = bars.length > 0;
  const hasFills = hasBars || plotted.some((entry) => entry.type === "area");
  const vertical = useMemo(
    () =>
      horizontal
        ? null
        : layoutVertical({
            axes,
            columns,
            count: data.length,
            formatTick: percent ? formatPercent : formatValue,
            percent,
            rows,
            slots: hasBars ? "band" : "point",
            values,
            zero: zero ?? hasFills,
          }),
    [
      horizontal,
      axes,
      columns,
      data.length,
      formatValue,
      percent,
      rows,
      hasBars,
      values,
      zero,
      hasFills,
    ]
  );
  const totalsKey = totals.join(",");
  const across = useMemo(
    () =>
      horizontal
        ? layoutHorizontal({
            bars: plotted.length,
            columns,
            formatValue,
            labels,
            percent,
            stacked: stack !== "none",
            values: [...values, ...totalsKey.split(",").map(Number)],
          })
        : null,
    [
      horizontal,
      plotted.length,
      columns,
      formatValue,
      labels,
      percent,
      stack,
      values,
      totalsKey,
    ]
  );
  const tableRows = useMemo(
    () =>
      labels.map((label, index) => ({
        label,
        values: plotted.map((entry) => {
          const share =
            percent && entry.type !== "line"
              ? ` · ${formatPercent(entry.high[index] - entry.low[index])}`
              : "";
          const range =
            entry.range === null || !Number.isFinite(entry.range.low[index])
              ? ""
              : ` (${formatValue(entry.range.low[index])}–${formatValue(entry.range.high[index])})`;
          return {
            color: entry.color,
            key: seriesKey(
              entry.type,
              glyphs,
              fillMode,
              entry.index,
              entry.dashed
            ),
            label: entry.label,
            value: Number.isFinite(entry.raw[index])
              ? `${formatValue(entry.raw[index])}${share}${range}`
              : "–",
          };
        }),
      })),
    [labels, plotted, formatValue, percent, glyphs, fillMode]
  );
  const highlighted = hasBars ? resolveHighlight(highlight, totals) : null;
  return useMemo(
    () => ({
      across,
      fillMode,
      formatValue,
      highlighted,
      labels,
      plotted,
      tableRows,
      vertical,
    }),
    [
      across,
      fillMode,
      formatValue,
      highlighted,
      labels,
      plotted,
      tableRows,
      vertical,
    ]
  );
};

type ChartModel = ReturnType<typeof useChartModel>;

/** The datum under a point in the plot, in px, or null when outside. */
const indexAtPoint = (
  { across, vertical, labels }: ChartModel,
  box: CellGrid,
  px: number,
  py: number
) => {
  if (across !== null) {
    const row = Math.floor(py / box.ch);
    return row >= 0 && row < labels.length * across.pitch
      ? across.indexAt(row)
      : null;
  }
  if (vertical === null) {
    return null;
  }
  const column = Math.floor(px / box.cw) - vertical.plot.left;
  return vertical.indexAt(clamp(column, 0, vertical.plot.columns - 1));
};

/** Where the readout sits for the scrubbed datum, in px. */
const readoutAnchor = (
  { across, vertical }: ChartModel,
  box: CellGrid,
  active: number,
  height: number
) => {
  if (across !== null) {
    return {
      height,
      width: box.width,
      x: (across.left + across.columns * 0.5) * box.cw,
      y: (across.rowOf(active) + across.pitch) * box.ch,
    };
  }
  if (vertical === null) {
    return null;
  }
  return {
    height,
    width: box.width,
    x:
      (vertical.plot.left + Math.floor(vertical.xDot(active) / 2) + 0.5) *
      box.cw,
    y: vertical.plot.top * box.ch,
  };
};

/** The frame for the current model and state. */
const drawChart = ({
  model,
  look,
  state,
  stack,
  columns,
  rows,
}: {
  model: ChartModel;
  look: ChartLook;
  state: DrawState;
  stack: ChartStack;
  columns: number;
  rows: number;
}) => {
  const { across, vertical, labels, plotted, formatValue } = model;
  if (across !== null) {
    return drawHorizontal({
      columns,
      formatValue,
      labels,
      layout: across,
      look,
      series: plotted,
      stacked: stack !== "none",
      state,
    });
  }
  if (vertical === null) {
    return new GlyphFrame(columns, rows);
  }
  return drawVertical({
    columns,
    formatValue: stack === "percent" ? formatPercent : formatValue,
    labels,
    layout: vertical,
    look,
    rows,
    series: plotted,
    stack,
    state,
  });
};

/** "Sep 12: Search 1.2K, Direct 480" for the live region. */
const announce = (
  row: { label: string; values: readonly ReadoutRow[] } | undefined
) =>
  row === undefined
    ? ""
    : `${row.label}: ${row.values.map((value) => `${value.label} ${value.value}`).join(", ")}`;

/** Every option, defaults resolved. */
type ChartOptions = Required<
  Pick<
    CartesianChartProps<unknown>,
    | "stack"
    | "glyphs"
    | "curve"
    | "markers"
    | "highlight"
    | "orientation"
    | "colors"
    | "height"
    | "axes"
    | "grid"
    | "tooltip"
    | "interactive"
    | "animate"
    | "glow"
  >
> &
  Pick<
    CartesianChartProps<unknown>,
    "fill" | "zero" | "cell" | "legend" | "format" | "summary" | "aria-label"
  >;

interface ChartBodyProps<T> {
  data: readonly T[];
  x: Accessor<T, string | number>;
  series: NonEmpty<CartesianSeries<T>>;
  options: ChartOptions;
  rootProps: Omit<ComponentProps<"div">, "children">;
}

/** Hovered or locked series from the legend. */
const useSpotlight = (interactive: boolean) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);
  return {
    focus: interactive ? (hovered ?? locked) : null,
    locked,
    setHovered,
    setLocked,
  };
};

/** A focusable, labelled group when interactive, else an image. */
const plotAccessibility = ({
  interactive,
  handlers,
  uid,
  label,
  count,
}: {
  interactive: boolean;
  handlers: ReturnType<typeof useScrub>["handlers"];
  uid: string;
  label: string;
  count: number;
}) =>
  interactive
    ? {
        ...handlers,
        "aria-describedby": `${uid}-keys`,
        "aria-label": label,
        "aria-roledescription": "chart",
        role: "group",
        tabIndex: count > 0 ? 0 : -1,
      }
    : { "aria-label": label, role: "img" };

const legendEntries = (model: ChartModel, glyphs: ChartGlyphs) =>
  model.plotted.map((entry) => ({
    color: entry.color,
    key: seriesKey(
      entry.type,
      glyphs,
      model.fillMode,
      entry.index,
      entry.dashed
    ),
    label: entry.label,
  }));

/** "Bar chart of Revenue and Costs, Jan to Dec." */
const describeChart = <T,>(
  data: readonly T[],
  x: Accessor<T, string | number>,
  plotted: readonly PlotSeries[],
  stack: ChartStack
) =>
  chartSummary({ data, kind: chartKind(plotted, stack), series: plotted, x });

const ChartBody = <T,>({
  data,
  x,
  series,
  options,
  rootProps: { className, ...props },
}: ChartBodyProps<T>) => {
  const {
    stack,
    glyphs,
    curve,
    markers,
    highlight,
    orientation,
    colors,
    height,
    axes,
    grid,
    tooltip,
    interactive,
    animate,
    glow,
    fill,
    zero,
    cell,
    legend,
    format,
    summary,
    "aria-label": ariaLabel,
  } = options;
  const uid = useId().replaceAll(":", "");
  const plotRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const box = useCellGrid(plotRef, cell);
  const reveal = useReveal(plotRef, animate);
  const { focus, locked, setHovered, setLocked } = useSpotlight(interactive);
  const horizontal = orientation === "horizontal";
  const columns = Math.max(8, Math.floor(box.width / box.cw));
  const rows = Math.max(4, Math.floor(height / box.ch));

  const model = useChartModel({
    axes,
    colors,
    columns,
    data,
    fill,
    format,
    glyphs,
    highlight,
    horizontal,
    rows,
    series,
    stack,
    x,
    zero,
  });
  const { scrub, handlers } = useScrub({
    count: data.length,
    indexAt: (px, py) => indexAtPoint(model, box, px, py),
    onEscape: () => setLocked(null),
    upDown: horizontal,
  });
  const active = interactive && scrub?.visible === true ? scrub.index : null;
  const look = useMemo<ChartLook>(
    () => ({
      barValues: true,
      curve,
      fill: model.fillMode,
      glyphs,
      grid,
      markers,
    }),
    [curve, model.fillMode, glyphs, grid, markers]
  );
  const frame = useMemo(
    () =>
      drawChart({
        columns,
        look,
        model,
        rows,
        stack,
        state: { active, focus, highlight: model.highlighted, reveal },
      }),
    [columns, look, model, rows, stack, active, focus, reveal]
  );
  const paint = usePaint({ focus, glow, series: model.plotted });
  const label =
    ariaLabel ?? summary ?? describeChart(data, x, model.plotted, stack);
  const activeRow = active === null ? undefined : model.tableRows[active];
  const showReadout = interactive && tooltip && activeRow !== undefined;
  const svgHeight = frame.rows * box.ch;
  useReadoutPosition(
    readoutRef,
    showReadout && active !== null
      ? readoutAnchor(model, box, active, svgHeight)
      : null
  );

  return (
    <div {...props} className={cn("relative w-full", className)}>
      <div
        ref={plotRef}
        {...plotAccessibility({
          count: data.length,
          handlers,
          interactive,
          label,
          uid,
        })}
        className="focus-visible:ring-ring/60 relative w-full touch-pan-y overflow-hidden rounded-sm outline-none focus-visible:ring-2"
        style={{ height: horizontal ? svgHeight : height }}
      >
        <GlyphSvg frame={frame} cw={box.cw} ch={box.ch} paint={paint} />
        {interactive && tooltip ? (
          <Readout
            ref={readoutRef}
            row={activeRow}
            visible={showReadout}
            focus={focus}
          />
        ) : null}
      </div>
      {(legend ?? model.plotted.length > 1) ? (
        <Legend
          entries={legendEntries(model, glyphs)}
          interactive={interactive}
          focus={focus}
          locked={locked}
          onHover={setHovered}
          onLock={setLocked}
        />
      ) : null}
      {interactive ? (
        <ScreenReaderStatus
          id={`${uid}-keys`}
          upDown={horizontal}
          text={announce(activeRow)}
        />
      ) : null}
      <DataTable
        summary={label}
        series={model.plotted}
        rows={model.tableRows}
      />
    </div>
  );
};

/**
 * A chart of lines, areas and bars over one category axis, drawn in
 * glyphs. Mix series freely: bars with a dashed target line, an area under
 * a forecast line. Scrub it with the pointer or the arrow keys for a
 * readout; hover a legend entry to spotlight a series. The data is also in
 * a visually hidden table.
 */
export const CartesianChart = <T,>({
  data,
  x,
  series,
  stack = "none",
  glyphs = "blocks",
  curve = "smooth",
  markers = "last",
  highlight = "last",
  orientation = "vertical",
  colors = [],
  height = 240,
  axes = true,
  grid = true,
  tooltip = true,
  interactive = true,
  animate = true,
  glow = false,
  fill,
  zero,
  cell,
  legend,
  format,
  summary,
  "aria-label": ariaLabel,
  ...rootProps
}: CartesianChartProps<T>) => (
  <ChartBody
    data={data}
    x={x}
    series={series}
    options={{
      animate,
      "aria-label": ariaLabel,
      axes,
      cell,
      colors,
      curve,
      fill,
      format,
      glow,
      glyphs,
      grid,
      height,
      highlight,
      interactive,
      legend,
      markers,
      orientation,
      stack,
      summary,
      tooltip,
      zero,
    }}
    rootProps={rootProps}
  />
);
