"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ComponentProps, CSSProperties } from "react";

import {
  cssColor,
  EIGHTHS_RIGHT,
  eighthsBar,
  MOTION,
  SERIES_COLORS,
  useFrameLoop,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
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

export type ProgressBarSize = "sm" | "md" | "lg";

/** The glyph drawn along the empty part of the track. */
export type ProgressTrack = "shade" | "dots" | "line" | "none";

/** One part of a stacked bar, such as one file type in a storage quota. */
export interface ProgressPart {
  /** Name in the legend and for screen readers. */
  label: string;
  /** Size of the part, in the same units as `max`. */
  value: number;
  /** Colour: a palette name or any CSS colour. Default: the next series colour. */
  color?: AsciiColor;
}

interface ProgressShared {
  /** What is in progress. Shown above the bar and used as its accessible name. */
  label: string;
  /** The value that means done (or the capacity, for parts). Default 100. */
  max?: number;
  /** Text for the readout and screen readers. Default: the percentage. */
  valueText?: string;
  /** Keep the label and readout for screen readers only. Default false. */
  hideLabel?: boolean;
  /** Glyph cell height: `sm` 12px, `md` 16px, `lg` 20px. Default `"md"`. */
  size?: ProgressBarSize;
  /** Glyph along the empty track: `░`, `·`, `─` or nothing. Default `"shade"`. */
  track?: ProgressTrack;
  /** Colour of the fill: a palette name or any CSS colour. Default `ink`. */
  color?: AsciiColor;
  /** Split the bar into this many blocks a cell apart, like a step meter. Default: one continuous bar. */
  segments?: number;
  /** Width in cells. Default: as many whole cells as fit the container. */
  columns?: number;
  /** Ease between values and grow in on mount. Default true; off under reduced motion. */
  animate?: boolean;
  /** Glyph cell height in CSS pixels. Overrides `size`. */
  cell?: number;
}

/** One value from 0 to `max`, or indeterminate when `value` is left out. */
export interface SingleProgressProps extends ProgressShared {
  /** Progress from 0 to `max`. Leave it out (or pass null) for an indeterminate bar. */
  value?: number | null;
  parts?: never;
  unit?: never;
}

/** Several parts stacked left to right, with a legend under the bar. */
export interface StackedProgressProps extends ProgressShared {
  /** The parts, left to right. Their sum is the total against `max`. */
  parts: readonly ProgressPart[];
  /** Shown after each part's value in the legend, such as `" GB"`. */
  unit?: string;
  value?: never;
}

export type ProgressBarProps = Omit<ComponentProps<"div">, "children"> &
  (SingleProgressProps | StackedProgressProps);

const CELLS = { lg: 20, md: 16, sm: 12 } as const satisfies Record<
  ProgressBarSize,
  number
>;

const TRACK_GLYPHS = {
  dots: "·",
  line: "─",
  none: " ",
  shade: "░",
} as const satisfies Record<ProgressTrack, string>;

/** Used for the first render, before the container is measured. */
const FALLBACK_COLUMNS = 32;
const PROBE = "0000000000";
/** The indeterminate comet: shaded tail, solid body, then an eighths head. */
const COMET_TAIL = ["░", "▒", "▓"] as const;
const COMET_BODY = 4;
const SWEEP_SECONDS = 1.8;

const clamp01 = (value: number) => (value > 0 ? Math.min(value, 1) : 0);

/** Font size and line height that make one line of text one glyph cell tall. */
const cellText = (cell: number): CSSProperties => ({
  fontFamily: "var(--ascii-font, monospace)",
  fontSize: `${cell / GLYPH_EM}px`,
  fontVariantLigatures: "none",
  letterSpacing: 0,
  lineHeight: `${cell}px`,
  whiteSpace: "pre",
});

/**
 * Whole glyph cells that fit the box, from the width of a probe set in the
 * same font. The probe is observed too, so a web font that loads late or a
 * zoom change measures again.
 */
const useColumns = (fixed: number | undefined) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [measured, setMeasured] = useState(FALLBACK_COLUMNS);
  useEffect(() => {
    const box = boxRef.current;
    const probe = probeRef.current;
    if (fixed !== undefined || !box || !probe) {
      return;
    }
    const measure = () => {
      const advance = probe.getBoundingClientRect().width / PROBE.length;
      // A hidden or unlaid-out box reads 0 wide: keep the last good count.
      if (advance > 0 && box.clientWidth > 0) {
        setMeasured(Math.max(1, Math.floor(box.clientWidth / advance + 0.01)));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [fixed]);
  return {
    boxRef,
    columns: fixed === undefined ? measured : Math.max(1, Math.round(fixed)),
    probeRef,
  };
};

/**
 * `target` eased from the values shown last, so a new value slides in
 * eighth by eighth instead of jumping. Starts from zeros when `animate`.
 */
const useEased = (
  target: readonly number[],
  animate: boolean
): readonly number[] => {
  const reduced = usePrefersReducedMotion();
  const live = animate && !reduced;
  const [shown, setShown] = useState<readonly number[]>(() =>
    live ? target.map(() => 0) : target
  );
  const shownRef = useRef(shown);
  const key = target.join(",");
  useEffect(() => {
    const goal = key === "" ? [] : key.split(",").map(Number);
    const from = shownRef.current;
    if (!live || from.length !== goal.length) {
      shownRef.current = goal;
      setShown(goal);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / MOTION.slow));
      // Ease out: fast toward the new value, settling gently on it.
      const eased = 1 - (1 - t) ** 4;
      const next = goal.map((value, index) => {
        const previous = from[index] ?? 0;
        return previous + (value - previous) * eased;
      });
      shownRef.current = next;
      setShown(next);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key, live]);
  return shown;
};

interface Layout {
  /** For each drawn cell, whether it is part of the bar (false: a gap). */
  readonly slots: readonly boolean[];
  /** Number of bar cells, gaps excluded. */
  readonly fillable: number;
}

/** The cells of the bar, cut into `segments` blocks one blank cell apart. */
const layoutCells = (columns: number, segments: number | undefined): Layout => {
  const count = segments === undefined ? 1 : Math.max(1, Math.round(segments));
  if (count < 2) {
    return {
      fillable: columns,
      slots: Array.from({ length: columns }, () => true),
    };
  }
  const width = Math.max(1, Math.floor((columns - (count - 1)) / count));
  const slots: boolean[] = [];
  for (let block = 0; block < count; block += 1) {
    if (block > 0) {
      slots.push(false);
    }
    for (let cell = 0; cell < width; cell += 1) {
      slots.push(true);
    }
  }
  return { fillable: width * count, slots };
};

/** Spread a run of glyphs, one per bar cell, over the layout's slots. */
const spread = (glyphs: string, layout: Layout): string => {
  const cells = [...glyphs];
  let next = 0;
  return layout.slots
    .map((slot) => {
      if (!slot) {
        return " ";
      }
      const glyph = cells[next] ?? " ";
      next += 1;
      return glyph;
    })
    .join("");
};

interface Run {
  readonly text: string;
  readonly color: AsciiColor;
}

interface StackedPart extends ProgressPart {
  readonly color: AsciiColor;
  readonly share: number;
}

/** Parts with their colours and shares of `max`, clipped to the track. */
const stackParts = (
  parts: readonly ProgressPart[],
  max: number
): StackedPart[] => {
  let room = 1;
  return parts.map((part, index) => {
    const share = Math.min(room, clamp01(Math.max(0, part.value) / max));
    room -= share;
    return {
      ...part,
      color: part.color ?? SERIES_COLORS[index % SERIES_COLORS.length] ?? "ink",
      share,
    };
  });
};

/**
 * Stacked fills as coloured runs. Part boundaries snap to whole cells (a
 * cell holds one glyph, so it can't show two colours side by side); the
 * leading edge of the total keeps its eighth-cell precision.
 */
const stackedRuns = (
  shares: readonly number[],
  colors: readonly AsciiColor[],
  layout: Layout
): Run[] => {
  const total = clamp01(shares.reduce((sum, share) => sum + share, 0));
  const edge = eighthsBar(total, layout.fillable);
  const solidCells = Math.floor(total * layout.fillable);
  const runs: Run[] = [];
  let used = 0;
  let cumulative = 0;
  for (const [index, share] of shares.entries()) {
    cumulative += share;
    const last = index === shares.length - 1 || cumulative >= total - 1e-9;
    const end = last
      ? layout.fillable
      : Math.min(solidCells, Math.round(cumulative * layout.fillable));
    if (end > used) {
      runs.push({ color: colors[index] ?? "ink", text: edge.slice(used, end) });
      used = end;
    }
    if (last) {
      break;
    }
  }
  return runs;
};

/** Cut runs into the slots of a segmented layout, keeping their colours. */
const spreadRuns = (runs: readonly Run[], layout: Layout): Run[] => {
  const flat = runs.flatMap((run) =>
    [...run.text].map((glyph) => ({ color: run.color, glyph }))
  );
  const out: Run[] = [];
  let next = 0;
  for (const slot of layout.slots) {
    const cell = slot ? flat[next] : undefined;
    if (slot) {
      next += 1;
    }
    const glyph = cell?.glyph ?? " ";
    const color = cell?.color ?? "ink";
    const previous = out.at(-1);
    if (previous && (previous.color === color || glyph === " ")) {
      out[out.length - 1] = {
        color: previous.color,
        text: previous.text + glyph,
      };
    } else {
      out.push({ color, text: glyph });
    }
  }
  return out;
};

/** The comet at sweep phase `t` (0 to 1) as one string of `cells` glyphs. */
const cometLine = (t: number, cells: number): string => {
  const length = COMET_TAIL.length + COMET_BODY;
  // In eighths: from the head just entering to the tail just leaving.
  const travel = (cells + length + 1) * 8;
  const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  const head = Math.round(eased * travel);
  const headCell = Math.floor(head / 8);
  const glyphs: string[] = Array.from({ length: cells }, () => " ");
  const put = (index: number, glyph: string) => {
    if (index >= 0 && index < cells) {
      glyphs[index] = glyph;
    }
  };
  put(headCell, EIGHTHS_RIGHT[head % 8] ?? " ");
  for (let offset = 1; offset <= length; offset += 1) {
    const tail = offset - COMET_BODY - 1;
    put(headCell - offset, tail < 0 ? "█" : (COMET_TAIL.at(-1 - tail) ?? "░"));
  }
  return glyphs.join("");
};

/** The indeterminate fill: a comet that sweeps the track on a loop. */
const Comet = ({ layout, color }: { layout: Layout; color: AsciiColor }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const draw = (time: number) => {
    const el = ref.current;
    if (el) {
      const phase = (time / SWEEP_SECONDS) % 1;
      el.textContent = spread(cometLine(phase, layout.fillable), layout);
    }
  };
  // Still frame under reduced motion: the comet rests mid-track.
  useFrameLoop(draw, { fps: 30, stillTime: SWEEP_SECONDS / 2, target: ref });
  return (
    <span
      ref={ref}
      className="absolute inset-0"
      style={{ ...SEAL, color: cssColor(color) }}
    >
      {spread(cometLine(0.5, layout.fillable), layout)}
    </span>
  );
};

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

/** Aria value props for a determinate or indeterminate bar. */
const ariaValues = ({
  determinate,
  current,
  max,
  readout,
  valueText,
}: {
  determinate: boolean;
  current: number;
  max: number;
  readout: string;
  valueText: string | undefined;
}) =>
  determinate
    ? {
        "aria-valuemax": max,
        "aria-valuemin": 0,
        "aria-valuenow": current,
        "aria-valuetext": readout,
      }
    : { "aria-valuetext": valueText };

/** What the fill eases toward: one share per part, the ratio, or nothing. */
const targetShares = (
  stacked: readonly StackedPart[] | null,
  determinate: boolean,
  ratio: number
): number[] => {
  if (stacked !== null) {
    return stacked.map((part) => part.share);
  }
  return determinate ? [ratio] : [];
};

/** The fill as coloured runs, from the shares shown right now. */
const fillRuns = ({
  stacked,
  shares,
  color,
  layout,
}: {
  stacked: readonly StackedPart[] | null;
  shares: readonly number[];
  color: AsciiColor;
  layout: Layout;
}): Run[] => {
  if (stacked !== null) {
    const colors = stacked.map((part) => part.color);
    return spreadRuns(stackedRuns(shares, colors, layout), layout);
  }
  if (shares.length === 0) {
    return [];
  }
  const text = spread(eighthsBar(shares[0] ?? 0, layout.fillable), layout);
  return [{ color, text }];
};

/** `█` swatch, label and value for each part, under a stacked bar. */
const Legend = ({
  parts,
  unit,
}: {
  parts: readonly StackedPart[];
  unit: string;
}) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1">
    {parts.map((part) => (
      <li
        key={part.label}
        className="text-muted-foreground flex items-baseline gap-1.5 text-xs"
      >
        <span
          aria-hidden="true"
          className="font-mono"
          style={{ color: cssColor(part.color) }}
        >
          █
        </span>
        <span className="text-foreground">{part.label}</span>
        <span className="font-mono tabular-nums">
          {`${number.format(part.value)}${unit}`}
        </span>
      </li>
    ))}
  </ul>
);

/**
 * A progress bar drawn in glyphs. The fill is eighth blocks (`▏▎▍▌▋▊▉█`),
 * so the value is exact to an eighth of a cell, over a track of `░`, `·`
 * or `─`. Without a `value`, a comet of shaded glyphs sweeps the track.
 * `parts` stacks several values in their own colours with a legend, and
 * `segments` cuts the bar into blocks for step meters.
 */
export const ProgressBar = ({
  label,
  value,
  parts,
  unit = "",
  max = 100,
  valueText,
  hideLabel = false,
  size = "md",
  track = "shade",
  color = "ink",
  segments,
  columns: fixedColumns,
  animate = true,
  cell,
  className,
  style,
  ...props
}: ProgressBarProps) => {
  const labelId = useId();
  const limit = Math.max(max, 1e-9);
  const stacked = parts === undefined ? null : stackParts(parts, limit);
  const total =
    parts === undefined
      ? (value ?? 0)
      : parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  const determinate = stacked !== null || typeof value === "number";
  const ratio = clamp01(total / limit);
  const readout = valueText ?? `${Math.round(ratio * 100)}%`;
  const height = cell ?? CELLS[size];

  const { boxRef, probeRef, columns } = useColumns(fixedColumns);
  const layout = layoutCells(columns, segments);
  const width = layout.slots.length;
  const shares = useEased(targetShares(stacked, determinate, ratio), animate);
  const fill = fillRuns({ color, layout, shares, stacked });
  const trackGlyph = TRACK_GLYPHS[track];
  const trackColor = cssColor(stacked === null ? color : "grey");

  return (
    <div
      role="progressbar"
      aria-labelledby={labelId}
      {...ariaValues({
        current: Math.min(max, Math.max(0, total)),
        determinate,
        max,
        readout,
        valueText,
      })}
      className={cn("flex w-full min-w-0 flex-col gap-2", className)}
      style={style}
      {...props}
    >
      <div
        className={cn(
          "flex items-baseline justify-between gap-4 text-sm",
          hideLabel && "sr-only"
        )}
      >
        <span id={labelId} className="text-foreground min-w-0 truncate">
          {label}
        </span>
        {determinate || valueText ? (
          <span
            aria-hidden="true"
            className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums"
          >
            {readout}
          </span>
        ) : null}
      </div>
      <div ref={boxRef} aria-hidden="true" className="relative w-full min-w-0">
        <span
          ref={probeRef}
          className="invisible absolute top-0 left-0"
          style={cellText(height)}
        >
          {PROBE}
        </span>
        <div
          className="relative overflow-hidden select-none"
          style={{ ...cellText(height), width: `${width}ch` }}
        >
          <span
            className="block"
            style={{
              color: `color-mix(in oklab, ${trackColor} 50%, transparent)`,
            }}
          >
            {spread(trackGlyph.repeat(layout.fillable), layout)}
          </span>
          {determinate ? (
            <span className="absolute inset-0" style={SEAL}>
              {fill.map((run, index) => (
                <span
                  // Runs are positional: the nth run of the bar.
                  // oxlint-disable-next-line react/no-array-index-key
                  key={index}
                  style={{ color: cssColor(run.color) }}
                >
                  {run.text}
                </span>
              ))}
            </span>
          ) : (
            <Comet layout={layout} color={color} />
          )}
        </div>
      </div>
      {stacked === null ? null : <Legend parts={stacked} unit={unit} />}
    </div>
  );
};
