"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";

import {
  GlyphRows,
  PLOT_SUBCELLS,
  createCells,
  createRaster,
  fillDots,
  plotLine,
  putGlyph,
  rasterCells,
  useCellBox,
} from "@/components/asciicn/glyph-plot";
import type { CellBox, GlyphCells } from "@/components/asciicn/glyph-plot";
import {
  cssColor,
  EIGHTHS_RIGHT,
  MOTION,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * `half`: a 180° arc, open at the bottom. `dial`: 270°, like a speedometer.
 * `ring`: a full circle starting at the top. `linear`: one row of eighth
 * blocks, for tight spaces.
 */
export type GaugeVariant = "half" | "dial" | "ring" | "linear";

/** `arc`: the arc fills up to the value. `needle`: a line points at it over a faint arc. */
export type GaugeIndicator = "arc" | "needle";

/** From `value` up (to the next threshold), the gauge is drawn in `color`. */
export interface GaugeThreshold {
  value: number;
  color: AsciiColor;
  /** Read out with the value, such as `"High"`, so the zone never relies on colour alone. */
  label?: string;
}

export type GaugeProps = Omit<ComponentProps<"div">, "children"> & {
  /** The reading, between `min` and `max`. */
  value: number;
  /** What is measured. Shown under the value and used as the accessible name. */
  label: string;
  /** Default 0. */
  min?: number;
  /** Default 100. */
  max?: number;
  /** Shape. Default `"half"`. */
  variant?: GaugeVariant;
  /** Arc variants: fill the arc or point a needle. Default `"arc"`. */
  indicator?: GaugeIndicator;
  /** Width in CSS pixels, rounded to whole cells. `linear` fills its container up to this. Default 220. */
  size?: number;
  /** Tick marks around the arc (or under the bar), ends included. 0 hides them. Default 5. */
  ticks?: number;
  /** Shown after the value, such as `"%"` or `" ms"`. */
  unit?: string;
  /** `Intl.NumberFormat` options for the value. Default: up to one decimal. */
  format?: Intl.NumberFormatOptions;
  /** Show `min` and `max` at the ends. Default true, except for `ring`. */
  showRange?: boolean;
  /** Colour of the value: a palette name or any CSS colour. Default `ink`. */
  color?: AsciiColor;
  /** Zones that recolour the gauge, such as orange from 70 and red from 90. Their bands show on the track. */
  thresholds?: readonly GaugeThreshold[];
  /** Colour of the track and ticks, drawn faint. Default `grey`. */
  trackColor?: AsciiColor;
  /** Sweep up to the value on mount and glide when it changes. Default true; off under reduced motion. */
  animate?: boolean;
  /** Glyph cell height in CSS pixels. Default `--ascii-cell`, or 12. */
  cell?: number;
};

interface Sweep {
  /** Start angle, degrees clockwise from 12 o'clock. */
  start: number;
  span: number;
}

const SWEEPS = {
  dial: { span: 270, start: -135 },
  half: { span: 180, start: -90 },
  ring: { span: 360, start: 0 },
} as const satisfies Record<Exclude<GaugeVariant, "linear">, Sweep>;

const TRACK = 1;
const TICK = 2;
/** Owners from here on are zones: the value colour, then each threshold. */
const ZONE = 3;
/** Track dots kept on: every other one, so the track reads as a texture, not a fill. */
const TRACK_SPARSE = 2;
const GLIDE_MS = MOTION.slow;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** The zone (0 for the base colour) a reading falls in. */
const zoneOf = (thresholds: readonly GaugeThreshold[], value: number) => {
  let zone = 0;
  for (const [index, threshold] of thresholds.entries()) {
    if (value >= threshold.value) {
      zone = index + 1;
    }
  }
  return zone;
};

/** Eases the drawn value toward `target`: from `from` on mount, then on every change. */
const useGlide = (target: number, from: number, animate: boolean) => {
  const reduced = usePrefersReducedMotion();
  const enabled = animate && !reduced;
  const [shown, setShown] = useState(enabled ? from : target);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (!enabled) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const start = shownRef.current;
    if (start === target) {
      return;
    }
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / GLIDE_MS);
      const value = start + (target - start) * (1 - (1 - t) ** 3);
      shownRef.current = value;
      setShown(value);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return shown;
};

/** Arc geometry, in CSS pixels from the grid's top-left corner. */
interface Dial {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  cx: number;
  cy: number;
  outer: number;
  inner: number;
  sweep: Sweep;
}

const layoutDial = ({
  variant,
  size,
  cell,
  aspect,
}: {
  variant: Exclude<GaugeVariant, "linear">;
  size: number;
  cell: number;
  aspect: number;
}): Dial => {
  const cellWidth = cell * aspect;
  const columns = Math.max(8, Math.round(size / cellWidth));
  const width = columns * cellWidth;
  // Room outside the arc for the tick marks.
  const margin = cell * 0.75;
  const outer = width / 2 - margin;
  const inner = outer * 0.8;
  const cy = margin + outer;
  const bottoms = {
    dial: cy + outer * Math.SQRT1_2 + margin / 2,
    half: cy + cell / 4,
    ring: cy + outer + margin,
  } as const satisfies Record<keyof typeof SWEEPS, number>;
  return {
    cellHeight: cell,
    cellWidth,
    columns,
    cx: width / 2,
    cy,
    inner,
    outer,
    rows: Math.ceil(bottoms[variant] / cell),
    sweep: SWEEPS[variant],
  };
};

const drawDial = ({
  dial,
  ratio,
  indicator,
  ticks,
  zone,
  bands,
}: {
  dial: Dial;
  ratio: number;
  indicator: GaugeIndicator;
  ticks: number;
  zone: number;
  /** Threshold bands on the track, as ratios with their zone. */
  bands: readonly { from: number; zone: number }[];
}): GlyphCells => {
  const [gx, gy] = PLOT_SUBCELLS.braille;
  const dotWidth = dial.cellWidth / gx;
  const dotHeight = dial.cellHeight / gy;
  const raster = createRaster({
    columns: dial.columns,
    glyphs: "braille",
    rows: dial.rows,
  });
  const { start, span } = dial.sweep;
  const reach = start + span * ratio;
  const bandAt = (fraction: number) => {
    let owner = TRACK;
    for (const band of bands) {
      if (fraction >= band.from) {
        owner = ZONE + band.zone;
      }
    }
    return owner;
  };
  const thin = indicator === "needle";
  const trackInner = thin
    ? dial.outer - (dial.outer - dial.inner) * 0.4
    : dial.inner;
  fillDots(raster, (x, y) => {
    const dx = x * dotWidth - dial.cx;
    const dy = y * dotHeight - dial.cy;
    const distance = Math.hypot(dx, dy);
    if (distance < trackInner || distance > dial.outer) {
      return 0;
    }
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (span === 360 && angle < 0) {
      angle += 360;
    }
    if (angle < start || angle > start + span) {
      return 0;
    }
    if (!thin && angle <= reach && ratio > 0) {
      return ZONE + zone;
    }
    // The track, threshold bands included, is half the dots, so it reads
    // as a texture under the solid value.
    const sparse = (Math.floor(x) + Math.floor(y)) % TRACK_SPARSE === 0;
    return sparse ? bandAt((angle - start) / span) : 0;
  });

  const toDot = (radius: number, degrees: number): [number, number] => {
    const radians = toRadians(degrees);
    return [
      (dial.cx + radius * Math.sin(radians)) / dotWidth,
      (dial.cy - radius * Math.cos(radians)) / dotHeight,
    ];
  };
  const count = span === 360 ? ticks - 1 : ticks;
  for (let index = 0; index < ticks; index += 1) {
    const degrees = start + (span * index) / Math.max(1, count);
    plotLine(
      raster,
      toDot(dial.outer + dotWidth * 1.5, degrees),
      toDot(dial.outer + dotWidth * 3.5, degrees),
      TICK
    );
  }
  if (thin) {
    // A needle two dots thick, from halfway out to the arc, clear of the readout.
    const [x0, y0] = toDot(dial.inner * 0.5, reach);
    const [x1, y1] = toDot(dial.outer, reach);
    plotLine(raster, [x0, y0], [x1, y1], ZONE + zone);
    plotLine(raster, [x0 + 1, y0], [x1 + 1, y1], ZONE + zone);
  }
  return rasterCells(raster);
};

/** The linear gauge: one row of eighth blocks over a shaded track, and a scale row. */
const drawBar = ({
  columns,
  ratio,
  zone,
  ticks,
  bands,
}: {
  columns: number;
  ratio: number;
  zone: number;
  ticks: number;
  bands: readonly { from: number; zone: number }[];
}): GlyphCells => {
  const cells = createCells(columns, 2);
  const eighths = Math.round(clamp01(ratio) * columns * 8);
  for (let column = 0; column < columns; column += 1) {
    const filled = Math.min(8, Math.max(0, eighths - column * 8));
    if (filled === 8 || (filled > 0 && column === Math.floor(eighths / 8))) {
      putGlyph(cells, column, 0, EIGHTHS_RIGHT[filled] ?? "█", ZONE + zone);
    } else {
      putGlyph(cells, column, 0, "░", TRACK);
    }
  }
  if (ticks > 0) {
    for (let index = 0; index < ticks; index += 1) {
      const column = Math.round(
        ((columns - 1) * index) / Math.max(1, ticks - 1)
      );
      putGlyph(cells, column, 1, "╵", TICK);
    }
  }
  for (const band of bands) {
    const column = Math.min(columns - 1, Math.round(band.from * columns));
    putGlyph(cells, column, 1, "▴", ZONE + band.zone);
  }
  return cells;
};

interface Reading {
  label: string;
  readout: string;
  /** The threshold label the reading falls in, if it has one. */
  zoneLabel: string | undefined;
  valueColor: string;
}

/** The reading and label in the middle of an arc. */
const ArcReadout = ({
  reading,
  variant,
  dial,
}: {
  reading: Reading;
  variant: Exclude<GaugeVariant, "linear">;
  dial: Dial;
}) => {
  const { zoneLabel } = reading;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 flex flex-col items-center font-mono",
        variant === "half" ? "bottom-0" : "-translate-y-1/2"
      )}
      style={variant === "half" ? undefined : { top: dial.cy }}
    >
      <span
        className="text-foreground leading-none font-semibold tracking-tight tabular-nums"
        style={{ fontSize: Math.max(14, Math.round(dial.inner * 0.32)) }}
      >
        {reading.readout}
      </span>
      <span
        className={cn(
          "mt-1.5 max-w-[70%] truncate text-[0.6875rem]",
          !zoneLabel && "text-muted-foreground"
        )}
        style={zoneLabel ? { color: reading.valueColor } : undefined}
      >
        {zoneLabel ? `${zoneLabel} · ${reading.label}` : reading.label}
      </span>
    </div>
  );
};

/** Min and max under the two ends of the arc. */
const ArcRange = ({
  dial,
  min,
  max,
}: {
  dial: Dial;
  min: string;
  max: string;
}) => {
  const middle = (dial.outer + dial.inner) / 2;
  const offset = middle * Math.sin(toRadians(dial.sweep.span / 2));
  return (
    <div
      aria-hidden="true"
      className="text-muted-foreground relative h-4 w-full font-mono text-[0.6875rem] tabular-nums"
    >
      <span
        className="absolute -translate-x-1/2"
        style={{ left: dial.cx - offset }}
      >
        {min}
      </span>
      <span
        className="absolute -translate-x-1/2"
        style={{ left: dial.cx + offset }}
      >
        {max}
      </span>
    </div>
  );
};

/** The label and reading above a linear gauge. */
const LinearHeader = ({ reading }: { reading: Reading }) => (
  <div
    aria-hidden="true"
    className="mb-1.5 flex items-baseline justify-between gap-3 text-xs"
  >
    <span className="text-muted-foreground min-w-0 truncate">
      {reading.label}
    </span>
    <span className="text-foreground shrink-0 font-semibold tabular-nums">
      {reading.zoneLabel ? (
        <span
          className="mr-2 font-normal"
          style={{ color: reading.valueColor }}
        >
          {reading.zoneLabel}
        </span>
      ) : null}
      {reading.readout}
    </span>
  </div>
);

/** The cells of a gauge `size` pixels wide, in a box measured as `box`. */
const drawGauge = ({
  variant,
  indicator,
  size,
  box,
  ratio,
  ticks,
  zone,
  bands,
}: {
  variant: GaugeVariant;
  indicator: GaugeIndicator;
  size: number;
  box: CellBox;
  ratio: number;
  ticks: number;
  zone: number;
  bands: readonly { from: number; zone: number }[];
}) => {
  if (variant === "linear") {
    // The bar fills its container up to `size`, in whole cells.
    const room = box.width > 0 ? Math.min(box.width, size) : size;
    const columns = Math.max(4, Math.floor(room / (box.cell * box.aspect)));
    return {
      cells: drawBar({ bands, columns, ratio, ticks, zone }),
      dial: null,
    };
  }
  const dial = layoutDial({
    aspect: box.aspect,
    cell: box.cell,
    size,
    variant,
  });
  return {
    cells: drawDial({ bands, dial, indicator, ratio, ticks, zone }),
    dial,
  };
};

/** Track and ticks faint in `trackColor`; each zone in its colour. */
const paintOwners =
  (zoneColors: readonly AsciiColor[], trackColor: AsciiColor) =>
  (owner: number) => {
    if (owner === TRACK) {
      return { color: cssColor(trackColor), opacity: 0.7 };
    }
    if (owner === TICK) {
      return { color: cssColor(trackColor), opacity: 0.8 };
    }
    return { color: cssColor(zoneColors[owner - ZONE] ?? "ink") };
  };

/** The meter role and values for assistive technology. */
const meterProps = ({
  label,
  min,
  max,
  value,
  reading,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  reading: Reading;
}) =>
  ({
    "aria-label": label,
    "aria-valuemax": max,
    "aria-valuemin": min,
    "aria-valuenow": value,
    "aria-valuetext": reading.zoneLabel
      ? `${reading.readout}, ${reading.zoneLabel}`
      : reading.readout,
    role: "meter",
  }) as const;

/**
 * A gauge for one reading, drawn in Braille dots: an arc that fills to the
 * value (or a needle that points at it) over a dotted track, with tick
 * marks, threshold bands and the reading in the middle. The `linear`
 * variant is a single row of eighth blocks. Exposed to assistive
 * technology as a meter.
 */
export const Gauge = ({
  value,
  label,
  min = 0,
  max = 100,
  variant = "half",
  indicator = "arc",
  size = 220,
  ticks = 5,
  unit = "",
  format = { maximumFractionDigits: 1 },
  showRange = variant !== "ring",
  color = "ink",
  thresholds = [],
  trackColor = "grey",
  animate = true,
  cell,
  className,
  style,
  ...props
}: GaugeProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const box = useCellBox(ref, cell);
  const clamped = Math.min(max, Math.max(min, value));
  const range = Math.max(max - min, 1e-9);
  const shown = useGlide(clamp01((clamped - min) / range), 0, animate);
  const sorted = [...thresholds].toSorted((a, b) => a.value - b.value);
  const zone = zoneOf(sorted, clamped);
  const zoneColors = [color, ...sorted.map((threshold) => threshold.color)];
  const formatter = new Intl.NumberFormat("en-US", format);
  const reading: Reading = {
    label,
    readout: `${formatter.format(clamped)}${unit}`,
    valueColor: cssColor(zoneColors[zone] ?? color),
    zoneLabel: sorted[zone - 1]?.label,
  };
  const { cells, dial } = drawGauge({
    bands: sorted.map((threshold, index) => ({
      from: clamp01((threshold.value - min) / range),
      zone: index + 1,
    })),
    box,
    indicator,
    ratio: shown,
    size,
    ticks: Math.max(0, Math.round(ticks)),
    variant,
    zone,
  });

  const paint = paintOwners(zoneColors, trackColor);
  const meter = meterProps({ label, max, min, reading, value: clamped });

  if (dial === null) {
    return (
      <div
        ref={ref}
        {...meter}
        className={cn("flex w-full flex-col font-mono", className)}
        style={{ maxWidth: size, ...style }}
        {...props}
      >
        <LinearHeader reading={reading} />
        <GlyphRows cells={cells} cell={box.cell} paint={paint} />
        <div
          aria-hidden="true"
          hidden={!showRange}
          className="text-muted-foreground flex justify-between text-[0.6875rem] tabular-nums"
        >
          <span>{formatter.format(min)}</span>
          <span>{formatter.format(max)}</span>
        </div>
      </div>
    );
  }

  const width = dial.columns * dial.cellWidth;
  return (
    <div
      ref={ref}
      {...meter}
      className={cn("relative inline-flex flex-col items-center", className)}
      style={{ width, ...style }}
      {...props}
    >
      <div
        className="relative"
        style={{ height: dial.rows * dial.cellHeight, width }}
      >
        <GlyphRows cells={cells} cell={dial.cellHeight} paint={paint} />
        {variant === "linear" ? null : (
          <ArcReadout reading={reading} variant={variant} dial={dial} />
        )}
      </div>
      {showRange && variant !== "ring" ? (
        <ArcRange
          dial={dial}
          min={formatter.format(min)}
          max={formatter.format(max)}
        />
      ) : null}
    </div>
  );
};
