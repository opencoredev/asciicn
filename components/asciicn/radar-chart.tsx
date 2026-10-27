"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { ComponentProps, KeyboardEvent, PointerEvent } from "react";

import {
  GlyphRows,
  PLOT_SUBCELLS,
  createRaster,
  fillDots,
  plotDot,
  plotLine,
  rasterCells,
  useCellBox,
  useIntro,
} from "@/components/asciicn/glyph-plot";
import { cssColor, MOTION, seriesColor } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

export type NonEmpty<T> = readonly [T, ...T[]];

export interface RadarSeries {
  /** Name in the legend, the tooltip and the data table. */
  label: string;
  /** One value per axis, in the order of `axes`. Missing values count as 0. */
  values: readonly number[];
  /** Colour: a palette name (`"green"`) or any CSS colour. Default: the chart's `colors`, then the series colours in order. */
  color?: AsciiColor;
}

/**
 * How values are written: `Intl.NumberFormat` options (usable from Server
 * Components) or a function.
 */
export type RadarFormat =
  | Intl.NumberFormatOptions
  | ((value: number) => string);

export type RadarChartProps = Omit<ComponentProps<"div">, "children"> & {
  /** Axis labels, clockwise from 12 o'clock. Three or more read best. */
  axes: NonEmpty<string>;
  /** One or more series, drawn in order (later ones on top). */
  series: NonEmpty<RadarSeries>;
  /** The value at the outer ring. Default: a round number above the largest value. */
  max?: number;
  /** Grid rings. Default 4. */
  rings?: number;
  /** Grid shape: straight-edged `polygon` or round `circle`. Default `polygon`. */
  grid?: "polygon" | "circle";
  /** Fill each series' area with a light scatter of dots under its outline. Default true. */
  fill?: boolean;
  /** Colours by series position. A series' own `color` wins. */
  colors?: readonly AsciiColor[];
  /** Largest width in CSS pixels; it shrinks to fit its container. Default 360. */
  size?: number;
  /** How values are written. Default compact, as in 1.2K. */
  format?: RadarFormat;
  /** Show the legend. Default: when there are two or more series. */
  legend?: boolean;
  /** Hover and keyboard scrubbing around the axes, and the legend spotlight. `false` for decoration. Default true. */
  interactive?: boolean;
  /** Grow out from the centre the first time the chart scrolls into view. Default true; off under reduced motion. */
  animate?: boolean;
  /** Glyph cell height in CSS pixels. Default `--ascii-cell`, or 12. */
  cell?: number;
};

const TAU = Math.PI * 2;
/** Room either side of the plot for axis labels, in CSS pixels. */
const LABEL_ROOM = 56;
const DIMMED = 0.25;
const GROW_MS = MOTION.slow + MOTION.base;

const GRID = 1;
const SPOKE_LIT = 2;
/** Series `i` owns `SERIES + 2i` (outline) and `SERIES + 2i + 1` (fill). */
const SERIES = 3;

const toFormatter = (format: RadarFormat | undefined) => {
  if (typeof format === "function") {
    return format;
  }
  const formatter = new Intl.NumberFormat(
    "en",
    format ?? { maximumFractionDigits: 1, notation: "compact" }
  );
  return (value: number) => formatter.format(value);
};

const NICE = [1, 2, 2.5, 5, 10];

/** A round outer value at or above `value`. */
const niceMax = (value: number) => {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = NICE.find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
};

interface Point {
  x: number;
  y: number;
}

/** The plot, in CSS pixels from the grid's top-left corner. */
interface Frame {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  cx: number;
  cy: number;
  radius: number;
  axes: number;
}

const layoutFrame = ({
  width,
  cell,
  aspect,
  axes,
}: {
  width: number;
  cell: number;
  aspect: number;
  axes: number;
}): Frame => {
  const cellWidth = cell * aspect;
  const columns = Math.max(12, Math.floor(width / cellWidth));
  const span = columns * cellWidth;
  const radius = Math.max(cell * 2, span / 2 - LABEL_ROOM);
  // Labels above and below need about a row and a half each.
  const rows = Math.ceil((radius * 2 + cell * 3) / cell);
  return {
    axes,
    cellHeight: cell,
    cellWidth,
    columns,
    cx: span / 2,
    cy: (rows * cell) / 2,
    radius,
    rows,
  };
};

/** The point at `fraction` of the radius along axis `axis`. */
const pointOn = (frame: Frame, axis: number, fraction: number): Point => {
  const angle = (axis / frame.axes) * TAU;
  return {
    x: frame.cx + Math.sin(angle) * frame.radius * fraction,
    y: frame.cy - Math.cos(angle) * frame.radius * fraction,
  };
};

/** Even-odd test: whether a point lies inside a closed polygon. */
const insidePolygon = (x: number, y: number, points: readonly Point[]) => {
  let inside = false;
  let previous = points.at(-1);
  for (const point of points) {
    if (
      previous &&
      point.y > y !== previous.y > y &&
      x <
        ((previous.x - point.x) * (y - point.y)) / (previous.y - point.y) +
          point.x
    ) {
      inside = !inside;
    }
    previous = point;
  }
  return inside;
};

interface Plotted {
  label: string;
  color: AsciiColor;
  values: number[];
}

const drawRadar = ({
  frame,
  series,
  max,
  rings,
  grid,
  fill,
  growth,
  axis,
}: {
  frame: Frame;
  series: readonly Plotted[];
  max: number;
  rings: number;
  grid: "polygon" | "circle";
  fill: boolean;
  growth: number;
  axis: number | null;
}) => {
  const [gx, gy] = PLOT_SUBCELLS.braille;
  const dotWidth = frame.cellWidth / gx;
  const dotHeight = frame.cellHeight / gy;
  const toDot = ({ x, y }: Point): [number, number] => [
    x / dotWidth - 0.5,
    y / dotHeight - 0.5,
  ];
  const raster = createRaster({
    columns: frame.columns,
    glyphs: "braille",
    rows: frame.rows,
  });

  // Rings and spokes take every other dot, so the grid reads lighter than the data.
  for (let ring = 1; ring <= rings; ring += 1) {
    const fraction = ring / rings;
    if (grid === "circle") {
      const radius = frame.radius * fraction;
      const steps = Math.ceil((TAU * radius) / Math.min(dotWidth, dotHeight));
      for (let step = 0; step < steps; step += 2) {
        const angle = (step / steps) * TAU;
        const [x, y] = toDot({
          x: frame.cx + Math.sin(angle) * radius,
          y: frame.cy - Math.cos(angle) * radius,
        });
        plotDot(raster, x, y, GRID);
      }
    } else {
      for (let index = 0; index < frame.axes; index += 1) {
        plotLine(
          raster,
          toDot(pointOn(frame, index, fraction)),
          toDot(pointOn(frame, (index + 1) % frame.axes, fraction)),
          GRID,
          2
        );
      }
    }
  }
  for (let index = 0; index < frame.axes; index += 1) {
    const lit = index === axis;
    plotLine(
      raster,
      toDot(pointOn(frame, index, 0)),
      toDot(pointOn(frame, index, 1)),
      lit ? SPOKE_LIT : GRID,
      lit ? 1 : 2
    );
  }

  const shapes = series.map((entry) =>
    entry.values.map((value, index) =>
      pointOn(frame, index, Math.min(1, Math.max(0, value / max)) * growth)
    )
  );
  if (fill) {
    // One dot in eight, staggered per series, so the outlines and the grid
    // stay readable through it and overlaps read denser.
    for (const [index, points] of shapes.entries()) {
      const owner = SERIES + index * 2 + 1;
      fillDots(raster, (x, y) => {
        const column = Math.floor(x);
        const row = Math.floor(y);
        if (row % 2 !== 0 || (column + row + index * 2) % 4 !== 0) {
          return 0;
        }
        return insidePolygon(x * dotWidth, y * dotHeight, points) ? owner : 0;
      });
    }
  }
  for (const [index, points] of shapes.entries()) {
    const owner = SERIES + index * 2;
    for (const [vertex, point] of points.entries()) {
      const next = points[(vertex + 1) % points.length] ?? point;
      plotLine(raster, toDot(point), toDot(next), owner);
    }
    // Vertices as small blocks of dots, larger on the lit axis.
    for (const [vertex, point] of points.entries()) {
      const [x, y] = toDot(point);
      const reach = vertex === axis ? 1 : 0;
      for (let dy = -reach; dy <= reach + 1; dy += 1) {
        for (let dx = -reach; dx <= reach; dx += 1) {
          plotDot(raster, x + dx, y + dy - 0.5, owner);
        }
      }
    }
  }
  return rasterCells(raster);
};

/** Where an axis label sits, snapped to whole cells. */
const labelPlacement = (frame: Frame, axis: number) => {
  const angle = (axis / frame.axes) * TAU;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const x = frame.cx + sin * (frame.radius + frame.cellWidth * 2);
  const y = frame.cy - cos * (frame.radius + frame.cellHeight);
  let align: "start" | "center" | "end" = "center";
  if (sin > 0.25) {
    align = "start";
  } else if (sin < -0.25) {
    align = "end";
  }
  return {
    align,
    left: Math.round(x / frame.cellWidth) * frame.cellWidth,
    top: Math.round(y / frame.cellHeight - 0.5) * frame.cellHeight,
  };
};

/**
 * Series plotted across several axes, drawn in Braille: dotted rings and
 * spokes, one-dot outlines per series with a light scatter of dots inside,
 * and labels aligned to the text grid. Hover or arrow around the axes to
 * read every series on one axis; hover a legend row to light one series.
 */
export const RadarChart = ({
  axes,
  series,
  max,
  rings = 4,
  grid = "polygon",
  fill = true,
  colors,
  size = 360,
  format,
  legend = series.length > 1,
  interactive = true,
  animate = true,
  cell,
  className,
  style,
  ...props
}: RadarChartProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replaceAll(":", "");
  const box = useCellBox(ref, cell);
  const formatValue = useMemo(() => toFormatter(format), [format]);
  const plotted: Plotted[] = series.map((entry, index) => ({
    color: entry.color ?? seriesColor(colors?.[index], index),
    label: entry.label,
    values: axes.map((_, axis) => {
      const value = entry.values[axis] ?? 0;
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    }),
  }));
  const top =
    max ?? niceMax(Math.max(...plotted.flatMap(({ values }) => values)));
  const growth = useIntro(ref, { animate, duration: GROW_MS });
  const [axis, setAxis] = useState<number | null>(null);
  const [spot, setSpot] = useState<number | null>(null);
  const activeAxis = interactive ? axis : null;
  const frame = layoutFrame({
    aspect: box.aspect,
    axes: axes.length,
    cell: box.cell,
    width: box.width > 0 ? Math.min(box.width, size) : size,
  });
  const cells = drawRadar({
    axis: activeAxis,
    fill,
    frame,
    grid,
    growth,
    max: top,
    rings: Math.max(1, Math.round(rings)),
    series: plotted,
  });

  const paint = (owner: number) => {
    if (owner === GRID) {
      return { color: "var(--muted-foreground)", opacity: 0.6 };
    }
    if (owner === SPOKE_LIT) {
      return { color: "var(--foreground)" };
    }
    const index = Math.floor((owner - SERIES) / 2);
    const isFill = (owner - SERIES) % 2 === 1;
    const entry = plotted[index];
    const dim = spot !== null && spot !== index;
    return {
      color: entry ? cssColor(entry.color) : undefined,
      opacity: (dim ? DIMMED : 1) * (isFill ? 0.6 : 1),
      transition: `opacity ${MOTION.fast}ms`,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - rect.left - frame.cx;
    const dy = event.clientY - rect.top - frame.cy;
    if (Math.hypot(dx, dy) > frame.radius + LABEL_ROOM) {
      setAxis(null);
      return;
    }
    const angle = (Math.atan2(dx, -dy) + TAU) % TAU;
    setAxis(Math.round((angle / TAU) * axes.length) % axes.length);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = axes.length;
    const forward = axis === null ? 0 : (axis + 1) % count;
    const back = axis === null ? count - 1 : (axis - 1 + count) % count;
    const moves: Record<string, number | undefined> = {
      ArrowDown: forward,
      ArrowLeft: back,
      ArrowRight: forward,
      ArrowUp: back,
      End: count - 1,
      Home: 0,
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setAxis(next);
    } else if (event.key === "Escape") {
      setAxis(null);
    }
  };

  const summary = `Radar chart of ${plotted.map(({ label }) => label).join(", ")} across ${String(axes.length)} axes: ${axes.join(", ")}. Outer ring ${formatValue(top)}.`;
  const tipAt = activeAxis === null ? null : pointOn(frame, activeAxis, 0.5);

  return (
    <div
      className={cn("flex w-full flex-col items-center gap-4", className)}
      style={{ maxWidth: size, ...style }}
      {...props}
    >
      <div ref={ref} className="w-full">
        <div
          className={cn(
            "focus-visible:outline-ring relative mx-auto rounded-md outline-offset-4 focus-visible:outline-2",
            interactive && "cursor-crosshair"
          )}
          style={{
            height: frame.rows * frame.cellHeight,
            width: frame.columns * frame.cellWidth,
          }}
          {...(interactive
            ? {
                "aria-describedby": `${uid}-keys`,
                "aria-label": summary,
                "aria-roledescription": "chart",
                onBlur: () => setAxis(null),
                onKeyDown,
                onPointerLeave: () => setAxis(null),
                onPointerMove,
                role: "group",
                tabIndex: 0,
              }
            : { "aria-label": summary, role: "img" })}
        >
          <GlyphRows cells={cells} cell={frame.cellHeight} paint={paint} />
          {axes.map((name, index) => {
            const place = labelPlacement(frame, index);
            return (
              <span
                key={name}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute font-mono text-[0.6875rem] whitespace-nowrap",
                  index === activeAxis
                    ? "text-foreground"
                    : "text-muted-foreground",
                  place.align === "center" && "-translate-x-1/2",
                  place.align === "end" && "-translate-x-full"
                )}
                style={{
                  left: place.left,
                  lineHeight: `${frame.cellHeight}px`,
                  top: place.top,
                }}
              >
                {name}
              </span>
            );
          })}
          {tipAt && activeAxis !== null ? (
            <div
              aria-hidden="true"
              className="bg-popover/95 text-popover-foreground border-border pointer-events-none absolute z-10 flex min-w-36 -translate-x-1/2 -translate-y-1/2 flex-col gap-1 rounded-md border px-2.5 py-2 font-mono text-xs shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm"
              style={{ left: tipAt.x, top: tipAt.y }}
            >
              <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                {axes[activeAxis]}
              </span>
              {plotted.map((entry) => (
                <span key={entry.label} className="flex items-center gap-2">
                  <span style={{ color: cssColor(entry.color) }}>⣿</span>
                  <span className="text-foreground flex-1">{entry.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatValue(entry.values[activeAxis] ?? 0)}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <ul
        className={cn(
          "flex flex-wrap justify-center gap-x-2 gap-y-1 font-mono text-xs",
          !legend && "sr-only"
        )}
      >
        {plotted.map((entry, index) => (
          <li key={entry.label}>
            <button
              type="button"
              disabled={!interactive}
              aria-pressed={spot === index}
              onPointerEnter={() => setSpot(index)}
              onPointerLeave={() => setSpot(null)}
              onFocus={() => setSpot(index)}
              onBlur={() => setSpot(null)}
              className="hover:bg-muted/60 focus-visible:outline-ring flex items-center gap-2 rounded-sm px-1.5 py-1 transition-opacity focus-visible:outline-2 disabled:cursor-default"
              style={{ opacity: spot !== null && spot !== index ? 0.5 : 1 }}
            >
              <span aria-hidden="true" style={{ color: cssColor(entry.color) }}>
                ⣿
              </span>
              <span className="text-foreground">{entry.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {interactive ? (
        <>
          <p id={`${uid}-keys`} className="sr-only">
            Use the arrow keys to move between axes and read every series on one
            axis. Escape clears.
          </p>
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {activeAxis === null
              ? ""
              : `${axes[activeAxis] ?? ""}: ${plotted
                  .map(
                    (entry) =>
                      `${entry.label} ${formatValue(entry.values[activeAxis] ?? 0)}`
                  )
                  .join(", ")}`}
          </div>
        </>
      ) : null}
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">Axis</th>
            {plotted.map((entry) => (
              <th key={entry.label} scope="col">
                {entry.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {axes.map((name, index) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {plotted.map((entry) => (
                <td key={entry.label}>
                  {formatValue(entry.values[index] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
