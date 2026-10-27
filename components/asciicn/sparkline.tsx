"use client";

import { useRef, useState } from "react";
import type { ComponentProps, KeyboardEvent, PointerEvent } from "react";

import {
  BRAILLE_DOT_BITS,
  brailleChar,
  cssColor,
  EIGHTHS_UP,
  isInked,
  MOTION,
  useFrameLoop,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

// Braille glyphs are bit masks.
/* oxlint-disable no-bitwise */

/**
 * `eighths`: one bar per value in eighth blocks (`▁▃▅▇`). `braille`: a
 * line on a 2x4 dot grid, two values per cell. `ascii`: plain characters
 * (`_.-~'^`) that sit at the value's height.
 */
export type SparklineGlyphs = "eighths" | "braille" | "ascii";

export const SPARKLINE_GLYPHS = [
  "eighths",
  "braille",
  "ascii",
] as const satisfies readonly SparklineGlyphs[];

export interface SparklineProps extends Omit<
  ComponentProps<"span">,
  "children"
> {
  /** Values in order, oldest first. */
  data: readonly number[];
  /** What the trend shows, such as "Revenue, last 30 days". Starts the accessible summary. */
  label: string;
  /** The glyphs it draws with. Default `eighths`. */
  glyphs?: SparklineGlyphs;
  /**
   * Width in cells (characters). Default: one cell per value for
   * `eighths` and `ascii`, one per two values for `braille`. Values are
   * averaged or repeated to fit.
   */
  width?: number;
  /** Height in text rows. Default 1, so it sits on a line of text. */
  rows?: number;
  /** Colour: a palette name (`"green"`) or any CSS colour. Default `ink`. */
  color?: AsciiColor;
  /** Draw the latest value at full strength and the rest a step quieter. Default true. */
  dot?: boolean;
  /** Braille only: fill under the line with sparse dots. Default false. */
  fill?: boolean;
  /**
   * The value range the height covers, as `[min, max]`. Default: the
   * data's own range. Give a row of sparklines one domain to compare them.
   */
  domain?: readonly [number, number];
  /**
   * Scrub with the pointer or arrow keys to read single values. Default
   * false: a sparkline is usually a glance, not a tool.
   */
  interactive?: boolean;
  /** Cells fill in from the left on first view. Default true; off under reduced motion. */
  animate?: boolean;
  /** Formats values in the summary and the readout. Default compact (1.2K). */
  format?: Intl.NumberFormatOptions;
}

const COMPACT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 1,
  notation: "compact",
};

/** ASCII marks from low to high within one row. */
const ASCII_LEVELS = ["_", ".", "-", "~", "'", "^"] as const;

/** `data` resampled to `count` values: bucket means, or repeats. */
const resample = (data: readonly number[], count: number) => {
  if (data.length === 0 || count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, index) => {
    const from = Math.floor((index * data.length) / count);
    const to = Math.max(
      from + 1,
      Math.floor(((index + 1) * data.length) / count)
    );
    const bucket = data.slice(from, to);
    return bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
  });
};

/** 0 to 1 for a value inside the domain. */
const normalise = (value: number, [low, high]: readonly [number, number]) =>
  Math.min(1, Math.max(0, (value - low) / (high - low || 1)));

/** Rows of text, top first, for each glyph style. */
const plotEighths = (
  values: readonly number[],
  rows: number,
  domain: readonly [number, number]
) =>
  Array.from({ length: rows }, (_, fromTop) => {
    const row = rows - 1 - fromTop;
    return values
      .map((value) => {
        // At least one eighth, so the lowest value still shows.
        const height = Math.max(
          1,
          Math.round(normalise(value, domain) * rows * 8)
        );
        return EIGHTHS_UP[Math.min(8, Math.max(0, height - row * 8))] ?? " ";
      })
      .join("");
  });

const plotAscii = (
  values: readonly number[],
  rows: number,
  domain: readonly [number, number]
) => {
  const lines = Array.from({ length: rows }, () =>
    Array.from(values, () => " ")
  );
  const levels = ASCII_LEVELS.length;
  for (const [column, value] of values.entries()) {
    const step = Math.min(
      rows * levels - 1,
      Math.floor(normalise(value, domain) * rows * levels)
    );
    const row = rows - 1 - Math.floor(step / levels);
    lines[row][column] = ASCII_LEVELS[step % levels];
  }
  return lines.map((line) => line.join(""));
};

const plotBraille = (
  values: readonly number[],
  rows: number,
  columns: number,
  domain: readonly [number, number],
  fill: boolean
) => {
  const height = rows * 4;
  const masks = Array.from({ length: rows * columns }, () => 0);
  const set = (x: number, y: number) => {
    if (x >= 0 && x < columns * 2 && y >= 0 && y < height) {
      const at = Math.floor(y / 4) * columns + Math.floor(x / 2);
      const bit = BRAILLE_DOT_BITS[y % 4][x % 2];
      // Add each dot's bit once, so the sum is the mask.
      if ((masks[at] & bit) === 0) {
        masks[at] += bit;
      }
    }
  };
  let previous: number | null = null;
  for (const [x, value] of values.entries()) {
    const y = Math.round((1 - normalise(value, domain)) * (height - 1));
    // Join steep steps so the line never breaks.
    const from = previous ?? y;
    for (let step = Math.min(from, y); step <= Math.max(from, y); step += 1) {
      set(x, step);
    }
    if (fill) {
      for (let below = y + 1; below < height; below += 1) {
        if (isInked("bayer4", x, below, 0.3)) {
          set(x, below);
        }
      }
    }
    previous = y;
  }
  return Array.from({ length: rows }, (_, row) =>
    masks
      .slice(row * columns, (row + 1) * columns)
      .map((mask) => (mask === 0 ? " " : brailleChar(mask)))
      .join("")
  );
};

/** The rows of text for any glyph style, top first. */
const plotLines = ({
  glyphs,
  values,
  rows,
  columns,
  domain,
  fill,
}: {
  glyphs: SparklineGlyphs;
  values: readonly number[];
  rows: number;
  columns: number;
  domain: readonly [number, number];
  fill: boolean;
}) => {
  switch (glyphs) {
    case "braille": {
      return plotBraille(values, rows, columns, domain, fill);
    }
    case "ascii": {
      return plotAscii(values, rows, domain);
    }
    case "eighths": {
      return plotEighths(values, rows, domain);
    }
    default: {
      const exhaustive: never = glyphs;
      return exhaustive;
    }
  }
};

/** "Revenue: 1.2K to 3.4K, low 1K, high 3.6K". */
const describe = (
  label: string,
  data: readonly number[],
  numbers: Intl.NumberFormat
) => {
  const [first] = data;
  const last = data.at(-1);
  if (first === undefined || last === undefined) {
    return `${label}: no data`;
  }
  return `${label}: ${numbers.format(first)} to ${numbers.format(last)}, low ${numbers.format(Math.min(...data))}, high ${numbers.format(Math.max(...data))}`;
};

/** How many cells have filled in, stepping once per cell over the entrance. */
const useSweep = (
  target: { current: Element | null },
  cells: number,
  enabled: boolean
) => {
  const [shown, setShown] = useState(enabled ? 0 : cells);
  const duration = MOTION.slow / 1000;
  useFrameLoop(
    (time) => {
      const linear = Math.min(1, time / duration);
      setShown(Math.ceil((1 - (1 - linear) ** 2) * cells));
    },
    { enabled: enabled && shown < cells, stillTime: duration, target }
  );
  return enabled ? Math.min(shown, cells) : cells;
};

const STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
};

/** Pointer and arrow-key scrubbing over `count` cells. */
const useSparkScrub = (count: number) => {
  const [active, setActive] = useState<number | null>(null);
  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - box.left) / Math.max(1, box.width);
    setActive(Math.min(count - 1, Math.max(0, Math.floor(share * count))));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape") {
      setActive(null);
      return;
    }
    const step = STEPS[event.key];
    if (step === undefined || count === 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setActive((current) =>
      Math.min(count - 1, Math.max(0, (current ?? count - 1) + step))
    );
  };
  return {
    active,
    handlers: {
      onBlur: () => setActive(null),
      onFocus: () => setActive(count - 1),
      onKeyDown,
      onPointerLeave: () => setActive(null),
      onPointerMove,
    },
  };
};

/** One line of glyphs, with the emphasised cell split out. */
const SparkRow = ({
  text,
  strong,
}: {
  text: string;
  strong: number | null;
}) => {
  const chars = [...text];
  if (strong === null || strong >= chars.length) {
    return <span className="block">{text}</span>;
  }
  return (
    <span className="block">
      <span className="opacity-60">{chars.slice(0, strong).join("")}</span>
      {chars[strong]}
      <span className="opacity-60">{chars.slice(strong + 1).join("")}</span>
    </span>
  );
};

/** The value over the scrubbed cell, and its live announcement. */
const SparkReadout = ({
  active,
  text,
}: {
  active: number | null;
  text: string;
}) => (
  <>
    {active === null || text === "" ? null : (
      <span
        aria-hidden="true"
        className="bg-popover text-popover-foreground border-border pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 border px-1 font-mono text-[10px] leading-4 whitespace-nowrap tabular-nums"
        style={{ left: `${active + 0.5}ch` }}
      >
        {text}
      </span>
    )}
    <span aria-live="polite" className="sr-only">
      {text}
    </span>
  </>
);

/**
 * A tiny trend drawn as real text in glyphs, sized in character cells so
 * it sits inside a sentence, a table cell or a stat card and takes the
 * surrounding font size. The latest value draws at full strength. Its
 * accessible name summarises the trend in words.
 */
export const Sparkline = ({
  data,
  label,
  glyphs = "eighths",
  width,
  rows: rowsProp = 1,
  color = "ink",
  dot = true,
  fill = false,
  domain: domainProp,
  interactive = false,
  animate = true,
  format = COMPACT,
  className,
  style,
  ...props
}: SparklineProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const rows = Math.max(1, Math.round(rowsProp));
  const perCell = glyphs === "braille" ? 2 : 1;
  const columns = Math.max(
    1,
    Math.round(width ?? Math.ceil(data.length / perCell))
  );
  const values = resample(data, columns * perCell);
  const domain = domainProp ?? [Math.min(...data), Math.max(...data)];
  const shown = useSweep(ref, columns, animate);
  const { active, handlers } = useSparkScrub(columns);
  const numbers = new Intl.NumberFormat("en", format);
  const summary = describe(label, data, numbers);

  const lines = plotLines({ columns, domain, fill, glyphs, rows, values });
  // Cells not yet swept in stay blank, so the width never changes.
  const visible = lines.map((line) =>
    [...line].map((glyph, index) => (index < shown ? glyph : " ")).join("")
  );
  const strong = active ?? (dot && shown === columns ? columns - 1 : null);
  const activeValue =
    active === null
      ? undefined
      : values.slice(active * perCell, (active + 1) * perCell).at(-1);

  return (
    <span
      {...props}
      ref={ref}
      {...(interactive
        ? { ...handlers, "aria-label": summary, role: "group", tabIndex: 0 }
        : { "aria-label": summary, role: "img" })}
      className={cn(
        "relative inline-block align-middle leading-[1.2] tracking-normal whitespace-pre",
        interactive &&
          "focus-visible:ring-ring/60 cursor-crosshair rounded-[2px] outline-none focus-visible:ring-2",
        className
      )}
      style={{
        color: cssColor(color),
        fontFamily: "var(--ascii-font, ui-monospace, monospace)",
        fontVariantLigatures: "none",
        ...style,
      }}
    >
      <span aria-hidden="true" className="block">
        {visible.map((line, row) => (
          // oxlint-disable-next-line react/no-array-index-key -- rows have no identity but their position.
          <SparkRow key={row} text={line} strong={strong} />
        ))}
      </span>
      {interactive ? (
        <SparkReadout
          active={active}
          text={activeValue === undefined ? "" : numbers.format(activeValue)}
        />
      ) : null}
    </span>
  );
};
