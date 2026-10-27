"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { ComponentProps, KeyboardEvent, PointerEvent } from "react";

import {
  GlyphRows,
  PLOT_SUBCELLS,
  createRaster,
  fillDots,
  rasterCells,
  useCellBox,
  useIntro,
} from "@/components/asciicn/glyph-plot";
import type { PlotGlyphs } from "@/components/asciicn/glyph-plot";
import { cssColor, MOTION, seriesColor } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  /** Name in the legend, the tooltip and the data table. */
  label: string;
  /** Size of the slice. Negative values count as 0. */
  value: number;
  /** Colour: a palette name (`"green"`) or any CSS colour. Default: the chart's `colors`, then the series colours in order. */
  color?: AsciiColor;
}

/**
 * How values are written: `Intl.NumberFormat` options (usable from Server
 * Components) or a function.
 */
export type DonutFormat =
  | Intl.NumberFormatOptions
  | ((value: number) => string);

export type DonutChartProps = Omit<ComponentProps<"figure">, "children"> & {
  /** The slices, drawn clockwise from 12 o'clock in this order. */
  data: readonly DonutSlice[];
  /** What the total counts, such as `"Requests today"`. Shown in the centre and used in the summary. */
  label: string;
  /** `donut`: a ring with the total in the middle. `pie`: full wedges. Default `donut`. */
  mode?: "donut" | "pie";
  /** `braille`: fine 2x4 dots per cell. `quadrants`: chunky 2x2 blocks. Default `braille`. */
  glyphs?: PlotGlyphs;
  /** Colours by slice position, as palette names or CSS colours. A slice's own `color` wins. */
  colors?: readonly AsciiColor[];
  /** Diameter in CSS pixels; the grid rounds it to whole cells. Default 220. */
  size?: number;
  /** Donut only: ring thickness as a share of the radius, 0.1 to 0.9. Default 0.38. */
  thickness?: number;
  /** Gap between slices, in dots. 0 joins them. Default 2. */
  gap?: number;
  /** Shown after every value, such as `" GB"`. */
  unit?: string;
  /** How values are written. Default: whole numbers with separators. */
  format?: DonutFormat;
  /** Show the legend. When false it stays available to screen readers. Default true. */
  legend?: boolean;
  /** Hover, keyboard focus, the tooltip and the legend spotlight. `false` for a decorative chart. Default true. */
  interactive?: boolean;
  /** Sweep the slices in clockwise the first time the chart scrolls into view. Default true; off under reduced motion. */
  animate?: boolean;
  /** Glyph cell height in CSS pixels. Default `--ascii-cell`, or 12. */
  cell?: number;
};

const TAU = Math.PI * 2;
/** How far a lit slice steps outward, in cells. */
const POP = 0.5;
const DIMMED = 0.28;
const SWEEP_MS = MOTION.slow + MOTION.base * 2;

const toFormatter = (format: DonutFormat | undefined, unit: string) => {
  if (typeof format === "function") {
    return (value: number) => `${format(value)}${unit}`;
  }
  const formatter = new Intl.NumberFormat(
    "en",
    format ?? { maximumFractionDigits: 0 }
  );
  return (value: number) => `${formatter.format(value)}${unit}`;
};

const percent = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  style: "percent",
});

interface SliceGeometry {
  index: number;
  label: string;
  value: number;
  share: number;
  color: AsciiColor;
  /** Start and end angle, radians clockwise from 12 o'clock. */
  from: number;
  to: number;
}

const toSlices = (
  data: readonly DonutSlice[],
  colors: readonly AsciiColor[] | undefined
) => {
  const values = data.map(({ value }) =>
    Number.isFinite(value) ? Math.max(0, value) : 0
  );
  const total = values.reduce((sum, value) => sum + value, 0);
  let angle = 0;
  const slices: SliceGeometry[] = data.map((slice, index) => {
    const value = values[index] ?? 0;
    const share = total > 0 ? value / total : 0;
    const from = angle;
    angle += share * TAU;
    return {
      color: slice.color ?? seriesColor(colors?.[index], index),
      from,
      index,
      label: slice.label,
      share,
      to: angle,
      value,
    };
  });
  return { slices, total };
};

/** Angle of a point from the centre, clockwise from 12 o'clock, in [0, 2π). */
const angleOf = (dx: number, dy: number) => {
  const raw = Math.atan2(dx, -dy);
  return raw < 0 ? raw + TAU : raw;
};

/** Distance from a point to the ray at `angle`, or Infinity behind it. */
const rayDistance = (dx: number, dy: number, angle: number) => {
  const sx = Math.sin(angle);
  const sy = -Math.cos(angle);
  if (dx * sx + dy * sy < 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(dx * sy - dy * sx);
};

/** The ring, in CSS pixels from the grid's top-left corner. */
interface Ring {
  columns: number;
  rows: number;
  cx: number;
  cy: number;
  outer: number;
  inner: number;
  /** Cell width and height in CSS pixels. */
  cellWidth: number;
  cellHeight: number;
}

const layoutRing = ({
  size,
  cell,
  aspect,
  mode,
  thickness,
}: {
  size: number;
  cell: number;
  aspect: number;
  mode: "donut" | "pie";
  thickness: number;
}): Ring => {
  const cellWidth = cell * aspect;
  const rows = Math.max(4, Math.round(size / cell));
  const columns = Math.max(4, Math.round((rows * cell) / cellWidth));
  const cx = (columns * cellWidth) / 2;
  const cy = (rows * cell) / 2;
  const outer = Math.min(cx, cy) - POP * cell;
  const share = Math.min(0.9, Math.max(0.1, thickness));
  return {
    cellHeight: cell,
    cellWidth,
    columns,
    cx,
    cy,
    inner: mode === "pie" ? 0 : outer * (1 - share),
    outer,
    rows,
  };
};

/** The slice under a point, in pixels from the centre, or -1. */
const sliceAt = (
  slices: readonly SliceGeometry[],
  dx: number,
  dy: number
): number => {
  const angle = angleOf(dx, dy);
  return (
    slices.find(
      (slice) => slice.share > 0 && angle >= slice.from && angle < slice.to
    )?.index ?? -1
  );
};

/** Rasterise the ring: each dot is owned by its slice (index + 1). */
const drawRing = ({
  ring,
  slices,
  glyphs,
  gap,
  sweep,
  lit,
}: {
  ring: Ring;
  slices: readonly SliceGeometry[];
  glyphs: PlotGlyphs;
  gap: number;
  sweep: number;
  lit: number | null;
}) => {
  const [gx, gy] = PLOT_SUBCELLS[glyphs];
  const dotWidth = ring.cellWidth / gx;
  const dotHeight = ring.cellHeight / gy;
  const halfGap = (gap * Math.min(dotWidth, dotHeight)) / 2;
  const shown = slices.filter((slice) => slice.share > 0);
  const raster = createRaster({
    columns: ring.columns,
    glyphs,
    rows: ring.rows,
  });
  const popped = ring.outer + POP * ring.cellHeight;
  const limit = sweep * TAU;
  fillDots(raster, (x, y) => {
    const dx = x * dotWidth - ring.cx;
    const dy = y * dotHeight - ring.cy;
    const distance = Math.hypot(dx, dy);
    if (distance < ring.inner || distance > popped) {
      return 0;
    }
    const angle = angleOf(dx, dy);
    if (angle > limit) {
      return 0;
    }
    const index = sliceAt(shown, dx, dy);
    if (index < 0) {
      return 0;
    }
    if (distance > ring.outer && index !== lit) {
      return 0;
    }
    if (halfGap > 0 && shown.length > 1) {
      for (const slice of shown) {
        if (rayDistance(dx, dy, slice.from) < halfGap) {
          return 0;
        }
      }
    }
    return index + 1;
  });
  return rasterCells(raster);
};

/**
 * Hovered and locked slices. Hover (pointer, legend or keyboard) wins over
 * the locked one while it lasts.
 */
const useSpotlight = (slices: readonly SliceGeometry[]) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);
  const focus = hovered ?? locked;
  const shown = slices.filter((slice) => slice.share > 0);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (shown.length === 0) {
      return;
    }
    const position = shown.findIndex((slice) => slice.index === focus);
    const step = (by: number) => {
      // From nothing lit, the first step lands on the first or last slice.
      const from = position === -1 ? -Math.max(by, 0) : position;
      const next = (from + by + shown.length) % shown.length;
      setHovered(shown[next]?.index ?? null);
    };
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown": {
        event.preventDefault();
        step(1);
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        event.preventDefault();
        step(-1);
        break;
      }
      case "Home": {
        event.preventDefault();
        setHovered(shown[0]?.index ?? null);
        break;
      }
      case "End": {
        event.preventDefault();
        setHovered(shown.at(-1)?.index ?? null);
        break;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        setLocked(focus === locked ? null : focus);
        break;
      }
      case "Escape": {
        setHovered(null);
        setLocked(null);
        break;
      }
      default:
    }
  };

  return { focus, hovered, locked, onKeyDown, setHovered, setLocked };
};

/** The swatch glyph for a slice: a full cell of the chart's own glyphs. */
const swatchGlyph = (glyphs: PlotGlyphs) => (glyphs === "braille" ? "⣿" : "█");

const Centre = ({
  ring,
  slice,
  total,
  label,
  format,
}: {
  ring: Ring;
  slice: SliceGeometry | undefined;
  total: number;
  label: string;
  format: (value: number) => string;
}) => {
  const diameter = ring.inner * 2;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center font-mono"
      style={{
        left: ring.cx,
        top: ring.cy,
        width: diameter * 0.8,
      }}
    >
      <span
        className="text-foreground leading-none font-semibold tracking-tight tabular-nums"
        style={{ fontSize: Math.max(13, Math.round(diameter * 0.16)) }}
      >
        {format(slice?.value ?? total)}
      </span>
      <span className="text-muted-foreground mt-1.5 max-w-full truncate text-[0.6875rem]">
        {slice ? slice.label : label}
      </span>
      {slice ? (
        <span className="text-muted-foreground text-[0.6875rem] tabular-nums">
          {percent.format(slice.share)}
        </span>
      ) : null}
    </div>
  );
};

const Tooltip = ({
  slice,
  at,
  glyphs,
  format,
}: {
  slice: SliceGeometry | undefined;
  at: { x: number; y: number } | null;
  glyphs: PlotGlyphs;
  format: (value: number) => string;
}) => (
  <div
    aria-hidden="true"
    className="bg-popover/95 text-popover-foreground border-border pointer-events-none absolute top-0 left-0 z-10 flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-xs whitespace-nowrap shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none"
    style={{
      opacity: slice && at ? 1 : 0,
      transform: at
        ? `translate(${Math.round(at.x + 14)}px, ${Math.round(at.y + 14)}px)`
        : undefined,
    }}
  >
    {slice ? (
      <>
        <span style={{ color: cssColor(slice.color) }}>
          {swatchGlyph(glyphs)}
        </span>
        <span className="text-foreground">{slice.label}</span>
        <span className="text-muted-foreground tabular-nums">
          {format(slice.value)} · {percent.format(slice.share)}
        </span>
      </>
    ) : null}
  </div>
);

const Legend = ({
  slices,
  focus,
  locked,
  interactive,
  glyphs,
  format,
  hidden,
  onHover,
  onLock,
}: {
  slices: readonly SliceGeometry[];
  focus: number | null;
  locked: number | null;
  interactive: boolean;
  glyphs: PlotGlyphs;
  format: (value: number) => string;
  hidden: boolean;
  onHover: (index: number | null) => void;
  onLock: (index: number | null) => void;
}) => (
  <ul
    className={cn(
      "flex min-w-44 flex-col gap-0.5 font-mono text-xs",
      hidden && "sr-only"
    )}
  >
    {slices.map((slice) => {
      const dim = focus !== null && focus !== slice.index;
      const content = (
        <>
          <span aria-hidden="true" style={{ color: cssColor(slice.color) }}>
            {swatchGlyph(glyphs)}
          </span>
          <span className="text-foreground min-w-0 flex-1 truncate">
            {slice.label}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {format(slice.value)}
          </span>
          <span className="text-muted-foreground w-12 text-right tabular-nums">
            {percent.format(slice.share)}
          </span>
        </>
      );
      return (
        <li
          key={slice.index}
          className="transition-opacity motion-reduce:transition-none"
          style={{
            opacity: dim ? 0.45 : 1,
            transitionDuration: `${MOTION.fast}ms`,
          }}
        >
          {interactive ? (
            <button
              type="button"
              aria-pressed={locked === slice.index}
              onPointerEnter={() => onHover(slice.index)}
              onPointerLeave={() => onHover(null)}
              onFocus={() => onHover(slice.index)}
              onBlur={() => onHover(null)}
              onClick={() =>
                onLock(locked === slice.index ? null : slice.index)
              }
              className="hover:bg-muted/60 focus-visible:outline-ring aria-pressed:bg-muted flex w-full items-center gap-2.5 rounded-sm px-1.5 py-1 text-left focus-visible:outline-2"
            >
              {content}
            </button>
          ) : (
            <div className="flex items-center gap-2.5 px-1.5 py-1">
              {content}
            </div>
          )}
        </li>
      );
    })}
  </ul>
);

const DataTable = ({
  summary,
  slices,
  format,
}: {
  summary: string;
  slices: readonly SliceGeometry[];
  format: (value: number) => string;
}) => (
  <table className="sr-only">
    <caption>{summary}</caption>
    <thead>
      <tr>
        <th scope="col">Slice</th>
        <th scope="col">Value</th>
        <th scope="col">Share</th>
      </tr>
    </thead>
    <tbody>
      {slices.map((slice) => (
        <tr key={slice.index}>
          <th scope="row">{slice.label}</th>
          <td>{format(slice.value)}</td>
          <td>{percent.format(slice.share)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/**
 * A donut or pie chart drawn in Braille dots (or quadrant blocks), one
 * colour per slice, with clean gaps between them. Slices sweep in
 * clockwise. Hover a slice or its legend row to light it (it steps out a
 * little and the centre shows its value), click to keep it lit, and focus
 * the chart to step through slices with the arrow keys.
 */
export const DonutChart = ({
  data,
  label,
  mode = "donut",
  glyphs = "braille",
  colors,
  size = 220,
  thickness = 0.38,
  gap = 2,
  unit = "",
  format,
  legend = true,
  interactive = true,
  animate = true,
  cell,
  className,
  ...props
}: DonutChartProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replaceAll(":", "");
  const box = useCellBox(ref, cell);
  const formatValue = useMemo(() => toFormatter(format, unit), [format, unit]);
  const { slices, total } = useMemo(
    () => toSlices(data, colors),
    [colors, data]
  );
  const ring = layoutRing({
    aspect: box.aspect,
    cell: box.cell,
    mode,
    size,
    thickness,
  });
  const sweep = useIntro(ref, { animate, duration: SWEEP_MS });
  const spotlight = useSpotlight(slices);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const focus = interactive ? spotlight.focus : null;
  const cells = drawRing({ gap, glyphs, lit: focus, ring, slices, sweep });

  const active = focus === null ? undefined : slices[focus];
  const summary = `${mode === "pie" ? "Pie" : "Donut"} chart of ${label}: ${formatValue(total)} in total across ${String(slices.length)} slices.`;

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dx = x - ring.cx;
    const dy = y - ring.cy;
    const distance = Math.hypot(dx, dy);
    const inside =
      distance >= ring.inner && distance <= ring.outer + POP * ring.cellHeight;
    const index = inside ? sliceAt(slices, dx, dy) : -1;
    spotlight.setHovered(index < 0 ? null : index);
    setPointer(index < 0 ? null : { x, y });
  };
  const onPointerLeave = () => {
    spotlight.setHovered(null);
    setPointer(null);
  };

  return (
    <figure
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-10 gap-y-6",
        className
      )}
      {...props}
    >
      <div
        ref={ref}
        className={cn(
          "focus-visible:outline-ring relative shrink-0 rounded-md outline-offset-4 focus-visible:outline-2",
          interactive && "cursor-pointer"
        )}
        style={{
          height: ring.rows * ring.cellHeight,
          width: ring.columns * ring.cellWidth,
        }}
        {...(interactive
          ? {
              "aria-describedby": `${uid}-keys`,
              "aria-label": summary,
              "aria-roledescription": "chart",
              onBlur: () => spotlight.setHovered(null),
              onClick: () =>
                spotlight.setLocked(
                  spotlight.hovered === spotlight.locked
                    ? null
                    : spotlight.hovered
                ),
              onKeyDown: spotlight.onKeyDown,
              onPointerLeave,
              onPointerMove,
              role: "group",
              tabIndex: 0,
            }
          : { "aria-label": summary, role: "img" })}
      >
        <GlyphRows
          cells={cells}
          cell={ring.cellHeight}
          paint={(owner) => {
            const slice = slices[owner - 1];
            return {
              color: slice ? cssColor(slice.color) : undefined,
              opacity: focus !== null && owner - 1 !== focus ? DIMMED : 1,
              transition: `opacity ${MOTION.fast}ms`,
            };
          }}
        />
        {mode === "donut" ? (
          <Centre
            ring={ring}
            slice={active}
            total={total}
            label={label}
            format={formatValue}
          />
        ) : null}
        {interactive ? (
          <Tooltip
            slice={pointer ? active : undefined}
            at={pointer}
            glyphs={glyphs}
            format={formatValue}
          />
        ) : null}
      </div>
      <figcaption className="contents">
        <Legend
          slices={slices}
          focus={focus}
          locked={spotlight.locked}
          interactive={interactive}
          glyphs={glyphs}
          format={formatValue}
          onHover={spotlight.setHovered}
          onLock={spotlight.setLocked}
          hidden={!legend}
        />
      </figcaption>
      {interactive ? (
        <>
          <p id={`${uid}-keys`} className="sr-only">
            Use the arrow keys to move between slices, Enter to keep one lit,
            Escape to clear.
          </p>
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {active === undefined
              ? ""
              : `${active.label}: ${formatValue(active.value)}, ${percent.format(active.share)}`}
          </div>
        </>
      ) : null}
      <DataTable summary={summary} slices={slices} format={formatValue} />
    </figure>
  );
};
