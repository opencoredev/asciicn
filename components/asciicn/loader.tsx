"use client";

import { useRef } from "react";
import type { ComponentProps, CSSProperties } from "react";

import {
  BRAILLE_DOT_BITS,
  brailleChar,
  cssColor,
  EIGHTHS_UP,
  SPINNERS,
  useFrameLoop,
} from "@/lib/ascii";
import type { AsciiColor, SpinnerName } from "@/lib/ascii";
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

/**
 * `spinner` cycles one glyph through a `SPINNERS` sequence, `dots` walks a
 * bright dot along three, `wave` rolls eighth blocks like an equaliser and
 * `comet` sends a Braille comet across six cells.
 */
export type LoaderVariant = "spinner" | "dots" | "wave" | "comet";

export type LoaderSize = "sm" | "md" | "lg";

export interface LoaderProps extends Omit<
  ComponentProps<"span">,
  "children" | "color"
> {
  /** What is loading, announced politely to screen readers. Default `"Loading"`. */
  label?: string;
  /** Show the label as text next to the glyphs. Default false. */
  showLabel?: boolean;
  /** The animation. Default `"spinner"`. */
  variant?: LoaderVariant;
  /** For `variant="spinner"`: which glyph sequence. Default `"orbit"`. */
  spinner?: SpinnerName;
  /** Glyph cell height: `sm` 12px, `md` 16px, `lg` 24px. Default `"md"`. */
  size?: LoaderSize;
  /** Glyph colour: a palette name or any CSS colour, such as `"currentColor"`. Default `"ink"`. */
  color?: AsciiColor;
  /** Playback speed multiplier. Default 1. */
  speed?: number;
  /** Glyph cell height in CSS pixels. Overrides `size`. */
  cell?: number;
}

const CELLS = { lg: 24, md: 16, sm: 12 } as const satisfies Record<
  LoaderSize,
  number
>;

/** Frames per second of each variant at speed 1, and its width in cells. */
const TIMING = {
  comet: { cells: 6, rate: 28 },
  dots: { cells: 3, rate: 6 },
  spinner: { cells: 1, rate: 11 },
  wave: { cells: 6, rate: 24 },
} as const satisfies Record<LoaderVariant, { cells: number; rate: number }>;

const DOT_GLYPHS = ["·", "•", "●"] as const;

/** Dots: a bright dot steps along, the one it just left still half lit. */
const dotsFrame = (frame: number): string => {
  const head = frame % 4;
  let out = "";
  for (let index = 0; index < 3; index += 1) {
    let level = 0;
    if (index === head) {
      level = 2;
    } else if (index === head - 1) {
      level = 1;
    }
    out += DOT_GLYPHS[level];
  }
  return out;
};

/** Wave: each column rides a sine one step behind its left neighbour. */
const waveFrame = (frame: number, cells: number): string => {
  let out = "";
  for (let index = 0; index < cells; index += 1) {
    const phase = (frame / 24 - index / 7) * Math.PI * 2;
    const level = 1 + Math.round(((Math.sin(phase) + 1) / 2) * 7);
    out += EIGHTHS_UP[level] ?? "▄";
  }
  return out;
};

/** Dots lit per Braille column, from the comet's head back along its tail. */
const COMET_TAIL = [4, 4, 3, 2, 2, 1, 1, 1] as const;
/** Which rows a column with `n` dots lights, kept near the middle. */
const COMET_ROWS = [[], [2], [1, 2], [0, 1, 2], [0, 1, 2, 3]] as const;

/** Comet: a dense head of full Braille columns thinning to single dots. */
const cometFrame = (frame: number, cells: number): string => {
  const columns = cells * 2;
  const span = columns + COMET_TAIL.length;
  const head = frame % span;
  let out = "";
  for (let cell = 0; cell < cells; cell += 1) {
    let mask = 0;
    for (let side = 0; side < 2; side += 1) {
      const behind = head - (cell * 2 + side);
      const dots = behind >= 0 ? (COMET_TAIL[behind] ?? 0) : 0;
      for (const row of COMET_ROWS[dots] ?? []) {
        mask += BRAILLE_DOT_BITS[row]?.[side] ?? 0;
      }
    }
    out += mask === 0 ? " " : brailleChar(mask);
  }
  return out;
};

const glyphsAt = (
  variant: LoaderVariant,
  spinner: SpinnerName,
  frame: number
): string => {
  switch (variant) {
    case "spinner": {
      const frames = SPINNERS[spinner];
      return frames[frame % frames.length] ?? " ";
    }
    case "dots": {
      return dotsFrame(frame);
    }
    case "wave": {
      return waveFrame(frame, TIMING.wave.cells);
    }
    case "comet": {
      return cometFrame(frame, TIMING.comet.cells);
    }
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
};

/** The frame drawn when motion is off: one that reads as "busy" on its own. */
const STILL_FRAME = {
  comet: 9,
  dots: 1,
  spinner: 0,
  wave: 6,
} as const satisfies Record<LoaderVariant, number>;

/**
 * A loading indicator drawn in glyphs: a spinner from `SPINNERS`, walking
 * dots, an eighth-block wave or a Braille comet. It is a polite live
 * region, so screen readers hear `label` once; the glyphs are hidden from
 * them. The width is fixed in cells, so nothing around it shifts.
 */
export const Loader = ({
  label = "Loading",
  showLabel = false,
  variant = "spinner",
  spinner = "orbit",
  size = "md",
  color = "ink",
  speed = 1,
  cell,
  className,
  style,
  ...props
}: LoaderProps) => {
  const glyphRef = useRef<HTMLSpanElement>(null);
  const shown = useRef("");
  const height = cell ?? CELLS[size];
  const { cells, rate } = TIMING[variant];
  const still = STILL_FRAME[variant];
  // Frames per second of motion; speed 0 holds the still frame.
  const pace = rate * Math.max(speed, 0.01);

  useFrameLoop(
    (time) => {
      const el = glyphRef.current;
      if (!el) {
        return;
      }
      const text = glyphsAt(variant, spinner, Math.floor(time * pace));
      // Only touch the DOM when the glyphs change, not every tick.
      if (text !== shown.current) {
        shown.current = text;
        el.textContent = text;
      }
    },
    {
      enabled: speed > 0,
      fps: Math.min(60, Math.max(4, pace)),
      // Halfway into the still frame, so rounding can't land on its neighbour.
      stillTime: (still + 0.5) / pace,
      target: glyphRef,
    }
  );

  const glyphStyle: CSSProperties = {
    ...SEAL,
    color: cssColor(color),
    fontFamily: "var(--ascii-font, monospace)",
    fontSize: `${height / GLYPH_EM}px`,
    fontVariantLigatures: "none",
    letterSpacing: 0,
    lineHeight: `${height}px`,
    width: `${cells}ch`,
  };

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 align-middle", className)}
      style={style}
      {...props}
    >
      <span
        ref={glyphRef}
        aria-hidden="true"
        className="inline-block shrink-0 overflow-hidden whitespace-pre select-none"
        style={glyphStyle}
      >
        {glyphsAt(variant, spinner, still)}
      </span>
      <span
        className={cn(
          showLabel ? "text-muted-foreground font-mono text-xs" : "sr-only"
        )}
      >
        {label}
      </span>
    </span>
  );
};
