"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentProps, KeyboardEvent, PointerEvent } from "react";

import {
  FURNITURE,
  GlyphFrame,
  GlyphSvg,
  GlyphSwatch,
  INK,
  seriesInk,
  useCellGrid,
  useReveal,
} from "@/components/asciicn/cartesian-chart";
import type { InkPaint } from "@/components/asciicn/cartesian-chart";
import { cssColor, EIGHTHS_UP } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

export interface HeatmapDatum {
  /** The day, as `"YYYY-MM-DD"` or a `Date` (read in UTC). */
  date: string | Date;
  /** The day's value. Several entries for one day add up. */
  value: number;
}

/**
 * `shades`: light to full shade (`░▒▓█`). `blocks`: a bar inside each
 * square that rises with the value (`▂▄▆█`). `ascii`: plain characters
 * from `-` to `#`.
 */
export type HeatmapGlyphs = "shades" | "blocks" | "ascii";

export const HEATMAP_GLYPHS = [
  "shades",
  "blocks",
  "ascii",
] as const satisfies readonly HeatmapGlyphs[];

interface HeatmapShared {
  /** How many levels values map to, above empty, 2 to 6. Default 4. */
  steps?: number;
  /** The value drawn at the top level; larger values draw there too. Default: the largest value. */
  max?: number;
  /** What a value counts, for the readout: `"deploy"` or `{ one: "deploy", other: "deploys" }`. */
  unit?: string | { one: string; other: string };
  /** The glyph ladder for the levels. Default `shades`. */
  glyphs?: HeatmapGlyphs;
  /** Ink colour: a palette name or any CSS colour. Lower levels mix toward the paper. Default `ink`. */
  color?: AsciiColor;
  /** Glyph cell height in px. Shrinks to fit when the grid is too wide. Default `--ascii-cell` (12). */
  cell?: number;
  /** Show the Less to More level scale. Default true. */
  legend?: boolean;
  /** Hover and keyboard readout, and the legend spotlight. `false` for decoration. Default true. */
  interactive?: boolean;
  /** Squares sweep in from the top left on first view. Default true; off under reduced motion. */
  animate?: boolean;
}

/** One square per day, one column per week. */
export interface CalendarHeatmapProps extends HeatmapShared {
  mode?: "calendar";
  /** Values by day. Days without an entry count as 0. */
  data: readonly HeatmapDatum[];
  /** Weeks shown, ending with the latest day in `data`. On narrow screens the oldest drop off. Default 53. */
  weeks?: number;
  /** First row: 0 Sunday, 1 Monday. Default 0. */
  weekStart?: 0 | 1;
  rows?: never;
  columns?: never;
}

/** A grid of values, such as weekday by hour. */
export interface MatrixHeatmapProps extends HeatmapShared {
  mode: "matrix";
  /** Values by row, then column: `data[row][column]`. Missing values draw nothing. */
  data: readonly (readonly number[])[];
  /** Row labels, top to bottom. */
  rows: readonly string[];
  /** Column labels, left to right. Only as many as fit are shown. */
  columns: readonly string[];
  weeks?: never;
  weekStart?: never;
}

export type HeatmapProps = Omit<ComponentProps<"div">, "children"> &
  (CalendarHeatmapProps | MatrixHeatmapProps);

const DAY_MS = 86_400_000;

const count = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const longDate = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  weekday: "short",
  year: "numeric",
});
const shortDate = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});
const monthName = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});
const weekdayName = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  weekday: "short",
});

const withUnit = (value: number, unit: HeatmapShared["unit"]) => {
  const text = count.format(value);
  if (unit === undefined) {
    return text;
  }
  if (typeof unit === "string") {
    return `${text} ${unit}`;
  }
  return `${text} ${value === 1 ? unit.one : unit.other}`;
};

/** Days since the epoch, in UTC, so time zones never shift a square. */
const dayNumber = (date: string | Date) => {
  if (typeof date !== "string") {
    return Math.floor(date.getTime() / DAY_MS);
  }
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return Math.floor(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / DAY_MS
  );
};
const dateOf = (day: number) => new Date(day * DAY_MS);

interface Square {
  column: number;
  row: number;
  value: number;
  /** 0 for empty, else 1 to `steps`. */
  bucket: number;
  /** Readout heading: the date, or "Mon · 14:00". */
  label: string;
}

interface GridModel {
  columns: number;
  rows: number;
  /** In-range squares, column by column. */
  squares: readonly Square[];
  /** Square at `column * rows + row`, or undefined outside the range. */
  at: (column: number, row: number) => Square | undefined;
  columnLabels: readonly { column: number; text: string }[];
  rowLabels: readonly { row: number; text: string }[];
  summary: string;
}

const bucketOf = (value: number, max: number, steps: number) =>
  value <= 0
    ? 0
    : Math.min(steps, Math.max(1, Math.ceil((value / max) * steps)));

const indexSquares = (squares: readonly Square[], rows: number) => {
  const lookup = new Map<number, Square>();
  for (const square of squares) {
    lookup.set(square.column * rows + square.row, square);
  }
  return (column: number, row: number) =>
    row < 0 || row >= rows || column < 0
      ? undefined
      : lookup.get(column * rows + row);
};

/** Month labels where a month starts, skipping ones too close to fit. */
const monthLabels = (firstDay: number, columns: number) => {
  const labels: { column: number; text: string }[] = [];
  let previousMonth = dateOf(firstDay).getUTCMonth();
  let previousColumn = -10;
  for (let column = 0; column < columns; column += 1) {
    const date = dateOf(firstDay + column * 7 + 6);
    const month = date.getUTCMonth();
    const starts =
      column === 0 ? date.getUTCDate() <= 7 : month !== previousMonth;
    // A label needs about three columns of room.
    if (starts && column - previousColumn >= 3 && column <= columns - 2) {
      labels.push({ column, text: monthName.format(date) });
      previousColumn = column;
    }
    previousMonth = month;
  }
  return labels;
};

const buildCalendar = ({
  data,
  weeks,
  weekStart,
  steps,
  max,
  unit,
}: {
  data: readonly HeatmapDatum[];
  weeks: number;
  weekStart: 0 | 1;
  steps: number;
  max: number | undefined;
  unit: HeatmapShared["unit"];
}): GridModel => {
  const totals = new Map<number, number>();
  for (const datum of data) {
    const day = dayNumber(datum.date);
    const value = Number.isFinite(datum.value) ? datum.value : 0;
    totals.set(day, (totals.get(day) ?? 0) + value);
  }
  const lastDay = totals.size > 0 ? Math.max(...totals.keys()) : 0;
  // Weekday of the last day, counted from `weekStart` (1970-01-01 was a Thursday).
  const lastRow = (((lastDay + 4 - weekStart) % 7) + 7) % 7;
  const columns = Math.max(1, weeks);
  const firstDay = lastDay - lastRow - (columns - 1) * 7;
  const peak = max ?? Math.max(1, ...totals.values());
  const squares: Square[] = [];
  let total = 0;
  let busiest: Square | undefined;
  for (let day = firstDay; day <= lastDay; day += 1) {
    const value = Math.max(0, totals.get(day) ?? 0);
    const offset = day - firstDay;
    const square = {
      bucket: bucketOf(value, peak, steps),
      column: Math.floor(offset / 7),
      label: longDate.format(dateOf(day)),
      row: offset % 7,
      value,
    };
    total += value;
    if (busiest === undefined || value > busiest.value) {
      busiest = square;
    }
    squares.push(square);
  }
  // Label Monday, Wednesday and Friday, wherever the week starts.
  const rowLabels = [1, 3, 5].map((weekday) => {
    const row = (weekday - weekStart + 7) % 7;
    return { row, text: weekdayName.format(dateOf(firstDay + row)) };
  });
  const busy =
    busiest === undefined || busiest.value <= 0
      ? ""
      : `, busiest ${busiest.label} with ${withUnit(busiest.value, unit)}`;
  return {
    at: indexSquares(squares, 7),
    columnLabels: monthLabels(firstDay, columns),
    columns,
    rowLabels,
    rows: 7,
    squares,
    summary: `Calendar heatmap, ${shortDate.format(dateOf(firstDay))} to ${shortDate.format(dateOf(lastDay))}: ${withUnit(total, unit)} in total${busy}.`,
  };
};

const buildMatrix = ({
  data,
  rows,
  columns,
  steps,
  max,
  unit,
}: {
  data: readonly (readonly number[])[];
  rows: readonly string[];
  columns: readonly string[];
  steps: number;
  max: number | undefined;
  unit: HeatmapShared["unit"];
}): GridModel => {
  const values = data.flatMap((row) =>
    row.filter((value) => Number.isFinite(value))
  );
  const peak = max ?? Math.max(1, ...values);
  const squares: Square[] = [];
  let busiest: Square | undefined;
  for (let column = 0; column < columns.length; column += 1) {
    for (let row = 0; row < rows.length; row += 1) {
      const raw = data[row]?.[column];
      if (raw !== undefined && Number.isFinite(raw)) {
        const value = Math.max(0, raw);
        const square = {
          bucket: bucketOf(value, peak, steps),
          column,
          label: `${rows[row] ?? ""} · ${columns[column] ?? ""}`,
          row,
          value,
        };
        if (busiest === undefined || value > busiest.value) {
          busiest = square;
        }
        squares.push(square);
      }
    }
  }
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  return {
    at: indexSquares(squares, rows.length),
    columnLabels: columns.map((text, column) => ({ column, text })),
    columns: columns.length,
    rowLabels: rows.map((text, row) => ({ row, text })),
    rows: rows.length,
    squares,
    summary: `Heatmap of ${String(rows.length)} rows by ${String(columns.length)} columns: ${withUnit(total, unit)} in total${busiest === undefined ? "" : `, highest at ${busiest.label} with ${withUnit(busiest.value, unit)}`}.`,
  };
};

/** The model for either mode. */
const buildModel = (props: HeatmapProps, steps: number) =>
  props.mode === "matrix"
    ? buildMatrix({
        columns: props.columns,
        data: props.data,
        max: props.max,
        rows: props.rows,
        steps,
        unit: props.unit,
      })
    : buildCalendar({
        data: props.data,
        max: props.max,
        steps,
        unit: props.unit,
        weekStart: props.weekStart ?? 0,
        weeks: props.weeks ?? 53,
      });

/** Drop the first `offset` columns (the oldest weeks) from a model. */
const shiftModel = (model: GridModel, offset: number): GridModel => {
  if (offset <= 0) {
    return model;
  }
  const squares = model.squares
    .filter((square) => square.column >= offset)
    .map((square) => ({ ...square, column: square.column - offset }));
  return {
    ...model,
    at: indexSquares(squares, model.rows),
    columnLabels: model.columnLabels
      .filter(({ column }) => column >= offset)
      .map((label) => ({ ...label, column: label.column - offset })),
    columns: model.columns - offset,
    squares,
  };
};

/** The div props left after the mode-specific ones are taken out. */
const withoutModeProps = ({
  mode: _mode,
  data: _data,
  weeks: _weeks,
  weekStart: _weekStart,
  rows: _rows,
  columns: _columns,
  ...props
}: Omit<HeatmapProps, keyof HeatmapShared | "className" | "aria-label">) =>
  props;

// ---------------------------------------------------------------------------
// Glyphs
// ---------------------------------------------------------------------------

/** Level glyphs, lightest first. A ladder of `steps` takes the densest end. */
const LADDERS = {
  ascii: [".", ":", "-", "+", "*", "#"],
  shades: ["·", "∙", "░", "▒", "▓", "█"],
} as const;

/** The glyph for level `bucket` (1 to `steps`); 0 is an empty square. */
const levelGlyph = (glyphs: HeatmapGlyphs, bucket: number, steps: number) => {
  if (bucket === 0) {
    return glyphs === "blocks" ? "▁" : "·";
  }
  if (glyphs === "blocks") {
    return EIGHTHS_UP[Math.max(2, Math.round((bucket / steps) * 8))] ?? "█";
  }
  const ladder = LADDERS[glyphs];
  return ladder[ladder.length - steps + bucket - 1] ?? "█";
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface Fit {
  /** Cells from one square to the next: 3 (two-cell squares) or 2 (one-cell). */
  pitch: number;
  /** Cells per square. */
  width: number;
  /** Squares across. Calendars drop their oldest weeks to get here. */
  columns: number;
  /** Cells before the first square, for row labels. */
  gutter: number;
  /** Cell size multiplier, below 1 when a matrix only fits smaller. */
  scale: number;
}

const MIN_SCALE = 2 / 3;

/**
 * The widest layout that fits: two-cell squares with a gap, then one-cell
 * squares with a gap. Past that, calendars drop their oldest weeks and
 * matrices shrink their cells (down to two thirds).
 */
const fitGrid = ({
  available,
  gutter,
  columns,
  matrix,
}: {
  available: number;
  gutter: number;
  columns: number;
  matrix: boolean;
}): Fit => {
  for (const [pitch, width] of [
    [3, 2],
    [2, 1],
  ] as const) {
    if (gutter + columns * pitch - 1 <= available) {
      return { columns, gutter, pitch, scale: 1, width };
    }
  }
  if (matrix) {
    const need = gutter + columns * 2 - 1;
    return {
      columns,
      gutter,
      pitch: 2,
      scale: Math.max(MIN_SCALE, available / need),
      width: 1,
    };
  }
  return {
    columns: Math.max(1, Math.floor((available - gutter + 1) / 2)),
    gutter,
    pitch: 2,
    scale: 1,
    width: 1,
  };
};

/** Frame column of square column `column`. */
const squareX = (fit: Fit, column: number) => fit.gutter + column * fit.pitch;

/** The frame: column labels on top, row labels to the left, then squares. */
const drawHeatmap = ({
  model,
  fit,
  glyphs,
  steps,
  reveal,
  active,
}: {
  model: GridModel;
  fit: Fit;
  glyphs: HeatmapGlyphs;
  steps: number;
  reveal: number;
  active: { column: number; row: number } | null;
}) => {
  const frame = new GlyphFrame(
    fit.gutter + model.columns * fit.pitch,
    model.rows + 1
  );
  let end = Number.NEGATIVE_INFINITY;
  for (const { column, text } of model.columnLabels) {
    const x = squareX(fit, column);
    if (x > end + 1 && x + text.length <= frame.columns) {
      frame.write(x, 0, text, INK.label);
      end = x + text.length;
    }
  }
  for (const { row, text } of model.rowLabels) {
    frame.write(fit.gutter - 1 - text.length, row + 1, text, INK.label);
  }
  const span = model.columns + model.rows * 0.8;
  for (const square of model.squares) {
    if ((square.column + square.row * 0.8) / span <= reveal) {
      const glyph = levelGlyph(glyphs, square.bucket, steps);
      const ink = square.bucket === 0 ? INK.grid : seriesInk(square.bucket);
      for (let offset = 0; offset < fit.width; offset += 1) {
        frame.put(
          squareX(fit, square.column) + offset,
          square.row + 1,
          glyph,
          ink
        );
      }
    }
  }
  if (active !== null) {
    const x = squareX(fit, active.column);
    frame.put(x - 1, active.row + 1, "[", INK.strong);
    frame.put(x + fit.width, active.row + 1, "]", INK.strong);
  }
  return frame;
};

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

interface Active {
  column: number;
  row: number;
  visible: boolean;
}

/** The pointed or focused square, with pointer moves throttled to frames. */
const useActiveSquare = ({
  model,
  squareAt,
  onEscape,
}: {
  model: GridModel;
  squareAt: (x: number, y: number) => { column: number; row: number };
  onEscape: () => void;
}) => {
  const [active, setActive] = useState<Active | null>(null);
  const frame = useRef(0);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const hide = () =>
    setActive((current) =>
      current === null ? null : { ...current, visible: false }
    );

  const point = (x: number, y: number) => {
    const { column, row } = squareAt(x, y);
    if (model.at(column, row) === undefined) {
      hide();
      return;
    }
    setActive((current) =>
      current?.column === column && current.row === row && current.visible
        ? current
        : { column, row, visible: true }
    );
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
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
      if (pointer.current !== null) {
        point(pointer.current.x, pointer.current.y);
      }
    });
  };

  const onPointerLeave = () => {
    pointer.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    hide();
  };

  const last = model.squares.at(-1);
  const targetOf = (key: string, from: { column: number; row: number }) => {
    const step = ARROWS[key];
    if (step !== undefined) {
      return model.at(from.column + step[0], from.row + step[1]) ?? null;
    }
    if (key === "Home") {
      return model.squares[0] ?? null;
    }
    return key === "End" ? (last ?? null) : undefined;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      hide();
      onEscape();
      return;
    }
    const target = targetOf(
      event.key,
      active ?? { column: last?.column ?? 0, row: last?.row ?? 0 }
    );
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    // The docs bind the arrows to prev/next page; the grid owns them while focused.
    event.stopPropagation();
    if (target !== null) {
      setActive({ column: target.column, row: target.row, visible: true });
    }
  };

  const onFocus = () =>
    setActive((current) =>
      current?.visible === true
        ? current
        : {
            column: current?.column ?? last?.column ?? 0,
            row: current?.row ?? last?.row ?? 0,
            visible: true,
          }
    );

  return {
    active: active?.visible === true ? active : null,
    handlers: {
      onBlur: hide,
      onFocus,
      onKeyDown,
      onPointerLeave,
      onPointerMove,
    },
  };
};

/** The readout card over (or under) the active square. */
const Readout = ({
  square,
  anchor,
  unit,
}: {
  square: Square | undefined;
  anchor: { x: number; top: number; bottom: number; width: number } | null;
  unit: HeatmapShared["unit"];
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || anchor === null) {
      return;
    }
    const left = Math.min(
      Math.max(0, anchor.x - el.offsetWidth / 2),
      Math.max(0, anchor.width - el.offsetWidth)
    );
    const above = anchor.top - el.offsetHeight - 6;
    const top = above >= 0 ? above : anchor.bottom + 6;
    el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  });
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="bg-popover/95 text-popover-foreground border-border pointer-events-none absolute top-0 left-0 z-10 border font-mono text-[11px] leading-4 whitespace-nowrap shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm transition-opacity duration-150 ease-out motion-reduce:transition-none"
      style={{ opacity: anchor === null || square === undefined ? 0 : 1 }}
    >
      {square === undefined ? null : (
        <>
          <div className="border-border text-muted-foreground border-b px-2 py-1 tracking-wide uppercase">
            {square.label}
          </div>
          <div className="px-2 py-1 font-medium tabular-nums">
            {square.value > 0 ? withUnit(square.value, unit) : "None"}
          </div>
        </>
      )}
    </div>
  );
};

/** Upper bound of each level, for the legend's labels. */
const bucketText = ({
  bucket,
  steps,
  max,
  unit,
}: {
  bucket: number;
  steps: number;
  max: number;
  unit: HeatmapShared["unit"];
}) => {
  if (bucket === 0) {
    return "None";
  }
  if (bucket === steps) {
    return `More than ${withUnit((max * (bucket - 1)) / steps, unit)}`;
  }
  return `Up to ${withUnit((max * bucket) / steps, unit)}`;
};

/** Less … More: one toggle per level that spotlights its squares. */
const Legend = ({
  steps,
  glyphs,
  paint,
  focus,
  locked,
  interactive,
  max,
  unit,
  onHover,
  onLock,
}: {
  steps: number;
  glyphs: HeatmapGlyphs;
  paint: (ink: number) => InkPaint | undefined;
  focus: number | null;
  locked: number | null;
  interactive: boolean;
  max: number;
  unit: HeatmapShared["unit"];
  onHover: (bucket: number | null) => void;
  onLock: (bucket: number | null) => void;
}) => (
  <div className="text-muted-foreground mt-2 flex items-center justify-end gap-1 font-mono text-[11px]">
    <span className="mr-1">Less</span>
    <div
      className="flex items-center"
      {...(interactive
        ? { "aria-label": "Levels", role: "group" }
        : { "aria-hidden": true })}
    >
      {Array.from({ length: steps + 1 }, (_, bucket) => {
        const glyph = levelGlyph(glyphs, bucket, steps);
        const swatch = (
          <GlyphSwatch
            glyphs={`${glyph}${glyph}`}
            color={
              paint(bucket === 0 ? INK.grid : seriesInk(bucket))?.color ??
              "currentColor"
            }
          />
        );
        const dim = focus !== null && focus !== bucket && "opacity-35";
        const text = bucketText({ bucket, max, steps, unit });
        if (!interactive) {
          return (
            <span key={bucket} className={cn("p-1", dim)}>
              {swatch}
            </span>
          );
        }
        return (
          <button
            key={bucket}
            type="button"
            aria-pressed={locked === bucket}
            aria-label={text}
            title={text}
            onPointerEnter={() => onHover(bucket)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(bucket)}
            onBlur={() => onHover(null)}
            onClick={() => onLock(locked === bucket ? null : bucket)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onLock(null);
              }
            }}
            className={cn(
              "focus-visible:ring-ring/60 aria-pressed:bg-muted cursor-pointer rounded-sm p-1 transition-opacity duration-150 ease-out outline-none focus-visible:ring-2",
              dim
            )}
          >
            {swatch}
          </button>
        );
      })}
    </div>
    <span className="ml-1">More</span>
  </div>
);

/** Key help and a live readout for screen readers. */
const ScreenReaderStatus = ({ id, text }: { id: string; text: string }) => (
  <>
    <p id={id} className="sr-only">
      Use the arrow keys to move between squares, Home and End to jump to the
      first and last, Escape to clear.
    </p>
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  </>
);

/** Ink per level: the colour mixed toward the paper for lower levels. */
const usePaint = ({
  color,
  steps,
  focus,
}: {
  color: AsciiColor;
  steps: number;
  focus: number | null;
}) =>
  useMemo(() => {
    const css = cssColor(color);
    return (ink: number): InkPaint | undefined => {
      const bucket = ink - seriesInk(0);
      const dim = focus !== null && focus !== Math.max(0, bucket);
      if (ink === INK.grid) {
        return { ...FURNITURE[INK.grid], opacity: dim ? 0.3 : 1 };
      }
      if (bucket < 1 || bucket > steps) {
        return FURNITURE[ink];
      }
      return {
        color: `color-mix(in oklab, ${css} ${Math.round(45 + (55 * bucket) / steps)}%, var(--ascii-paper))`,
        opacity: dim ? 0.2 : 1,
      };
    };
  }, [color, steps, focus]);

/** Where the readout sits for the active square, in px; `pitch` is one row. */
const readoutAnchor = (
  active: { column: number; row: number } | null,
  fit: Fit,
  cw: number,
  pitch: number,
  width: number
) =>
  active === null
    ? null
    : {
        bottom: (active.row + 2) * pitch,
        top: (active.row + 1) * pitch,
        width,
        x: (squareX(fit, active.column) + fit.width / 2) * cw,
      };

// ---------------------------------------------------------------------------
// The heatmap
// ---------------------------------------------------------------------------

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

/**
 * A heatmap drawn in glyphs. Every square is two cells of one level glyph,
 * from light shade to full block (or a rising eighth block, or ASCII),
 * mixed toward the paper at lower levels. Calendar mode draws a day per
 * square and a week per column; matrix mode draws any grid, such as
 * weekday by hour. Hover or arrow through squares for a readout, and
 * hover a legend level to spotlight its squares.
 */
export const Heatmap = (allProps: HeatmapProps) => {
  const {
    steps: rawSteps = 4,
    max,
    unit,
    glyphs = "shades",
    color = "ink",
    cell,
    legend = true,
    interactive = true,
    animate = true,
    className,
    "aria-label": ariaLabel,
    ...rest
  } = allProps;
  const steps = Math.min(6, Math.max(2, Math.round(rawSteps)));
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replaceAll(":", "");
  const box = useCellGrid(ref, cell);
  const reveal = useReveal(ref, animate);
  const { focus, locked, setHovered, setLocked } = useSpotlight(interactive);

  const full = useMemo(() => buildModel(allProps, steps), [allProps, steps]);
  const fit = fitGrid({
    available: Math.floor(box.width / box.cw),
    columns: full.columns,
    gutter: Math.max(0, ...full.rowLabels.map(({ text }) => text.length)) + 2,
    matrix: allProps.mode === "matrix",
  });
  const offset = full.columns - fit.columns;
  const model = useMemo(() => shiftModel(full, offset), [full, offset]);
  const cw = box.cw * fit.scale;
  const ch = box.ch * fit.scale;
  // A quarter-cell gutter between rows keeps every square a separate tile.
  const gap = Math.max(1, Math.round(ch / 4));
  const pitch = ch + gap;
  const squareAt = (x: number, y: number) => ({
    column: Math.floor(
      (x / cw - fit.gutter + (fit.pitch - fit.width) / 2) / fit.pitch
    ),
    row: Math.floor(y / pitch) - 1,
  });
  const { active, handlers } = useActiveSquare({
    model,
    onEscape: () => setLocked(null),
    squareAt,
  });
  const frame = useMemo(
    () => drawHeatmap({ active, fit, glyphs, model, reveal, steps }),
    [active, fit, glyphs, model, reveal, steps]
  );
  const paint = usePaint({ color, focus, steps });
  const square =
    active === null ? undefined : model.at(active.column, active.row);
  const label = ariaLabel ?? model.summary;

  return (
    <div
      {...withoutModeProps(rest)}
      className={cn("relative w-full", className)}
    >
      <div
        ref={ref}
        {...(interactive
          ? {
              ...handlers,
              "aria-describedby": `${uid}-keys`,
              "aria-label": label,
              "aria-roledescription": "heatmap",
              role: "group",
              tabIndex: 0,
            }
          : { "aria-label": label, role: "img" })}
        className="focus-visible:ring-ring/60 relative w-full rounded-sm outline-none focus-visible:ring-2"
        style={{ height: frame.rows * pitch - gap }}
      >
        <GlyphSvg frame={frame} cw={cw} ch={ch} rowGap={gap} paint={paint} />
        {interactive ? (
          <Readout
            square={square}
            anchor={readoutAnchor(active, fit, cw, pitch, frame.columns * cw)}
            unit={unit}
          />
        ) : null}
      </div>
      {legend ? (
        <Legend
          steps={steps}
          glyphs={glyphs}
          paint={paint}
          focus={focus}
          locked={locked}
          interactive={interactive}
          max={max ?? Math.max(1, ...model.squares.map(({ value }) => value))}
          unit={unit}
          onHover={setHovered}
          onLock={setLocked}
        />
      ) : null}
      {interactive ? (
        <ScreenReaderStatus
          id={`${uid}-keys`}
          text={
            square === undefined
              ? ""
              : `${square.label}: ${square.value > 0 ? withUnit(square.value, unit) : "none"}`
          }
        />
      ) : null}
    </div>
  );
};
