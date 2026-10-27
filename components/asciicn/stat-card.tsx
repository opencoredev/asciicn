"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { BOX, cssColor, EIGHTHS_UP } from "@/lib/ascii";
import type { AsciiColor, BoxStyle } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * Font size per cell height for DOM glyphs. Cascadia Mono's full block and
 * box lines are 1.17em tall, so at this size blocks and lines in
 * neighbouring rows touch instead of leaving a hairline between them.
 */
const GLYPH_EM = 1.17;

/**
 * A hairline stroke in the text colour. Adjacent block glyphs meet at
 * fractional pixels, where anti-aliasing leaves a faint seam; the stroke
 * covers it without visibly thickening the glyphs.
 */
const SEAL = { WebkitTextStroke: "0.045em currentColor" } as const;

/** Which way the metric should move: revenue `up`, latency `down`. */
export type StatDirection = "up" | "down";

export type StatCardVariant = "default" | "compact";

export interface StatCardProps extends Omit<
  ComponentProps<"div">,
  "children" | "color"
> {
  /** What the number is, such as `"Monthly revenue"`. Set into the top of the frame. */
  label: string;
  /** The headline number. Numbers get thousands separators; strings show as given. */
  value: number | string;
  /** Change since the last period, in percent: `12.4` reads as `▲ 12.4%`. */
  delta?: number;
  /** What the change compares with, such as `"vs last month"`. */
  deltaLabel?: string;
  /** Which direction counts as good, for the delta colour. Default `"up"`. */
  good?: StatDirection;
  /** Recent values, oldest first, drawn as an eighth-block sparkline. */
  trend?: readonly number[];
  /** Height of the sparkline in rows; each row adds eight levels. Default 2 (1 when compact). */
  trendRows?: number;
  /** `default` stacks value, delta and sparkline; `compact` puts them on one line. Default `"default"`. */
  variant?: StatCardVariant;
  /** Box-drawing set for the frame. Default `"rounded"`. */
  frame?: BoxStyle;
  /** Colour of the sparkline: a palette name or any CSS colour. Default `"ink"`. */
  color?: AsciiColor;
  /** Glyph cell height in CSS pixels, for the frame and the sparkline. Default 14. */
  cell?: number;
}

const DEFAULT_CELL = 14;
/** Glyphs per clipped edge run: taller and wider than any card. */
const RUN_CELLS = 400;
const PROBE = "0000000000";
/** Sparkline width in cells for the compact card. */
const COMPACT_TREND = 12;

const cellText = (cell: number): CSSProperties => ({
  fontFamily: "var(--ascii-font, monospace)",
  fontSize: `${cell / GLYPH_EM}px`,
  fontVariantLigatures: "none",
  letterSpacing: 0,
  lineHeight: `${cell}px`,
  whiteSpace: "pre",
});

const integer = new Intl.NumberFormat("en");
const percent = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

/** Whole cells that fit the element, measured against a probe in the same font. */
const useColumns = (fallback: number) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [columns, setColumns] = useState(fallback);
  useEffect(() => {
    const box = boxRef.current;
    const probe = probeRef.current;
    if (!box || !probe) {
      return;
    }
    const measure = () => {
      const advance = probe.getBoundingClientRect().width / PROBE.length;
      // A hidden or unlaid-out box reads 0 wide: keep the last good count.
      if (advance > 0 && box.clientWidth > 0) {
        setColumns(Math.max(1, Math.floor(box.clientWidth / advance + 0.01)));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);
  return { boxRef, columns, probeRef };
};

/** `values` resampled to `count` points by linear interpolation. */
const resample = (values: readonly number[], count: number): number[] => {
  if (values.length === 0 || count <= 0) {
    return [];
  }
  if (values.length === 1) {
    return Array.from({ length: count }, () => values[0] ?? 0);
  }
  return Array.from({ length: count }, (_, index) => {
    const at = count === 1 ? 0 : (index / (count - 1)) * (values.length - 1);
    const low = Math.floor(at);
    const from = values[low] ?? 0;
    const to = values[Math.min(values.length - 1, low + 1)] ?? from;
    return from + (to - from) * (at - low);
  });
};

/**
 * Sparkline rows, top row first, in eighth blocks. Each value fills its
 * column from the bottom up to `rows * 8` levels; the lowest value keeps
 * one eighth so the line never breaks.
 */
const sparkRows = (values: readonly number[], rows: number): string[] => {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 1;
  const levels = rows * 8;
  const heights = values.map((value) =>
    Math.max(1, Math.round(((value - low) / range) * (levels - 1)) + 1)
  );
  return Array.from({ length: rows }, (_, index) => {
    const floor = (rows - 1 - index) * 8;
    return heights
      .map(
        (height) => EIGHTHS_UP[Math.min(8, Math.max(0, height - floor))] ?? " "
      )
      .join("");
  });
};

const Sparkline = ({
  trend,
  rows,
  color,
  cell,
  columns: fixed,
}: {
  trend: readonly number[];
  rows: number;
  color: AsciiColor;
  cell: number;
  columns?: number;
}) => {
  const { boxRef, columns, probeRef } = useColumns(fixed ?? 24);
  const count = fixed ?? columns;
  const lines = sparkRows(resample(trend, count), rows);
  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      className={cn("relative select-none", fixed === undefined && "w-full")}
      style={{ ...cellText(cell), ...SEAL, color: cssColor(color) }}
    >
      <span ref={probeRef} className="invisible absolute top-0 left-0">
        {PROBE}
      </span>
      {lines.map((line, index) => (
        // Rows are positional, top to bottom.
        // oxlint-disable-next-line react/no-array-index-key
        <span key={index} className="block overflow-hidden">
          {line}
        </span>
      ))}
    </div>
  );
};

const Delta = ({
  delta,
  deltaLabel,
  good,
}: {
  delta: number;
  deltaLabel: string | undefined;
  good: StatDirection;
}) => {
  let direction: StatDirection | "flat" = "flat";
  if (delta > 0) {
    direction = "up";
  } else if (delta < 0) {
    direction = "down";
  }
  const glyph = { down: "▼", flat: "■", up: "▲" }[direction];
  const words = { down: "Down", flat: "No change,", up: "Up" }[direction];
  let tone: AsciiColor = "grey";
  if (direction !== "flat") {
    tone = direction === good ? "green" : "red";
  }
  return (
    <p className="text-muted-foreground flex min-w-0 items-baseline gap-2 font-mono text-xs">
      <span className="shrink-0 tabular-nums" style={{ color: cssColor(tone) }}>
        <span aria-hidden="true">{glyph} </span>
        <span className="sr-only">{words} </span>
        {`${percent.format(Math.abs(delta))}%`}
      </span>
      {deltaLabel ? <span className="truncate">{deltaLabel}</span> : null}
    </p>
  );
};

/** A run of one glyph, clipped to its box so it never sets the frame's size. */
const Edge = ({ glyph, vertical }: { glyph: string; vertical?: boolean }) => (
  <span aria-hidden="true" className="relative min-h-0 min-w-0 flex-1">
    <span className="absolute inset-0 overflow-hidden">
      {vertical
        ? Array.from({ length: RUN_CELLS }, () => glyph).join("\n")
        : glyph.repeat(RUN_CELLS)}
    </span>
  </span>
);

/**
 * A box-drawing frame with a title set into its top edge, like a terminal
 * panel: `╭─ Revenue ───╮`. The edges are clipped runs of glyphs, so the
 * frame follows its content at any size.
 */
const Frame = ({
  title,
  box,
  cell,
  children,
}: {
  title: string;
  box: BoxStyle;
  cell: number;
  children: ReactNode;
}) => {
  const set = BOX[box];
  return (
    <div
      className="grid grid-cols-[1ch_minmax(0,1fr)_1ch] grid-rows-[1lh_auto_1lh]"
      style={cellText(cell)}
    >
      <span aria-hidden="true" style={{ color: cssColor("grey") }}>
        {set.tl}
      </span>
      <span className="flex min-w-0">
        <span aria-hidden="true" style={{ color: cssColor("grey") }}>
          {`${set.h} `}
        </span>
        <span className="text-muted-foreground min-w-0 truncate">{title}</span>
        <span
          aria-hidden="true"
          className="flex min-w-[1ch] flex-1"
          style={{ color: cssColor("grey") }}
        >
          {" "}
          <Edge glyph={set.h} />
        </span>
      </span>
      <span aria-hidden="true" style={{ color: cssColor("grey") }}>
        {set.tr}
      </span>
      <span className="flex" style={{ color: cssColor("grey") }}>
        <Edge glyph={set.v} vertical />
      </span>
      <div className="min-w-0 px-[1ch] py-[0.5lh] whitespace-normal">
        {children}
      </div>
      <span className="flex" style={{ color: cssColor("grey") }}>
        <Edge glyph={set.v} vertical />
      </span>
      <span aria-hidden="true" style={{ color: cssColor("grey") }}>
        {set.bl}
      </span>
      <span className="flex" style={{ color: cssColor("grey") }}>
        <Edge glyph={set.h} />
      </span>
      <span aria-hidden="true" style={{ color: cssColor("grey") }}>
        {set.br}
      </span>
    </div>
  );
};

/**
 * A KPI card in a box-drawing frame: the label set into the top edge, a
 * big number, a `▲`/`▼` delta coloured by whether the move is good, and
 * an eighth-block sparkline that fills the card's width. `compact` puts
 * it all on one line for dense dashboards.
 */
export const StatCard = ({
  label,
  value,
  delta,
  deltaLabel,
  good = "up",
  trend,
  trendRows,
  variant = "default",
  frame = "rounded",
  color = "ink",
  cell = DEFAULT_CELL,
  className,
  ...props
}: StatCardProps) => {
  const shown = typeof value === "number" ? integer.format(value) : value;
  const hasTrend = trend !== undefined && trend.length > 0;
  const compact = variant === "compact";
  const valueText = (
    <p
      className={cn(
        "text-foreground font-mono font-semibold tracking-tight tabular-nums",
        compact ? "text-xl" : "text-3xl"
      )}
    >
      {shown}
    </p>
  );
  const deltaRow =
    delta === undefined ? null : (
      <Delta delta={delta} deltaLabel={deltaLabel} good={good} />
    );

  return (
    <div
      className={cn("bg-background text-foreground min-w-0", className)}
      {...props}
    >
      <Frame title={label} box={frame} cell={cell}>
        {compact ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {valueText}
              {deltaRow}
            </div>
            {hasTrend ? (
              <Sparkline
                trend={trend}
                rows={trendRows ?? 1}
                color={color}
                cell={cell}
                columns={COMPACT_TREND}
              />
            ) : null}
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            {valueText}
            {deltaRow}
            {hasTrend ? (
              <div className="pt-3">
                <Sparkline
                  trend={trend}
                  rows={trendRows ?? 2}
                  color={color}
                  cell={cell}
                />
              </div>
            ) : null}
          </div>
        )}
      </Frame>
    </div>
  );
};
