"use client";

import { useRef, useState } from "react";
import type { ComponentProps, CSSProperties } from "react";

import { cssColor, useFrameLoop } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * The glyphs around the label: `[ OK ]`, `< beta >`, `( new )`, `┤ v2 ├`,
 * or `inverse` for a solid label in reverse video, as a terminal marks a
 * selection.
 */
export const ASCII_BADGE_SHAPES = [
  "square",
  "angle",
  "round",
  "pipe",
  "inverse",
] as const;

export type AsciiBadgeShape = (typeof ASCII_BADGE_SHAPES)[number];

/** Meaning of the badge, which sets its colour. */
export const ASCII_BADGE_TONES = [
  "neutral",
  "ok",
  "info",
  "warn",
  "error",
  "accent",
] as const;

export type AsciiBadgeTone = (typeof ASCII_BADGE_TONES)[number];

export type AsciiBadgeSize = "sm" | "md" | "lg";

export interface AsciiBadgeProps extends Omit<ComponentProps<"span">, "color"> {
  /** The glyphs around the label. Default `"square"`. */
  shape?: AsciiBadgeShape;
  /** Sets the colour: ink, green, blue, orange, red or purple. Default `"neutral"`. */
  tone?: AsciiBadgeTone;
  /** Colour override: a palette name or any CSS colour. Default: the tone's colour. */
  color?: AsciiColor;
  /** A `●` before the label that pings, for live or running states. Default `false`. */
  dot?: boolean;
  /** Centre the label in at least this many cells, so a column of badges lines up, as in `[ OK ]` over `[FAIL]`. Default: the label plus a cell each side. */
  width?: number;
  /** Glyph cell height: `sm` 12px, `md` 16px, `lg` 20px. Default `"md"`. */
  size?: AsciiBadgeSize;
  /** Glyph cell height in CSS pixels. Overrides `size`. */
  cell?: number;
}

const CELLS = { lg: 20, md: 16, sm: 12 } as const satisfies Record<
  AsciiBadgeSize,
  number
>;

const TONE_COLORS = {
  accent: "purple",
  error: "red",
  info: "blue",
  neutral: "ink",
  ok: "green",
  warn: "orange",
} as const satisfies Record<AsciiBadgeTone, AsciiColor>;

const ENDS = {
  angle: ["<", ">"],
  inverse: ["", ""],
  pipe: ["┤", "├"],
  round: ["(", ")"],
  square: ["[", "]"],
} as const satisfies Record<AsciiBadgeShape, readonly [string, string]>;

/** The live dot holds solid, then opens out like a ping. */
const PING = ["●", "●", "●", "●", "◉", "◎", "◎", "◉"] as const;
const PING_RATE = 6;

const LiveDot = () => {
  const ref = useRef<HTMLSpanElement>(null);
  const [tick, setTick] = useState(0);
  useFrameLoop((time) => setTick(Math.floor(time * PING_RATE)), {
    fps: PING_RATE * 2,
    target: ref,
  });
  return (
    <span ref={ref} aria-hidden="true" className="inline-block w-[1ch]">
      {PING[tick % PING.length] ?? "●"}
    </span>
  );
};

/**
 * A status badge set in glyphs: a label in brackets, chevrons, parentheses
 * or box-drawing tees, or in reverse video. Tones colour it from the
 * `--ascii-color-*` palette, `width` lines a column of badges up like a
 * boot log, and `dot` adds a pinging `●` for live states.
 */
export const AsciiBadge = ({
  shape = "square",
  tone = "neutral",
  color,
  dot = false,
  width,
  size = "md",
  cell,
  className,
  style,
  children,
  ...props
}: AsciiBadgeProps) => {
  const height = cell ?? CELLS[size];
  const ink = cssColor(color ?? TONE_COLORS[tone]);
  const inverse = shape === "inverse";
  const [open, close] = ENDS[shape];
  const fixed = width !== undefined && !inverse;

  const rootStyle: CSSProperties = {
    color: inverse ? "var(--ascii-paper)" : ink,
    fontFamily: "var(--ascii-font, monospace)",
    fontSize: `${height / 1.2}px`,
    fontVariantLigatures: "none",
    letterSpacing: 0,
    lineHeight: `${height}px`,
    ...style,
  };

  return (
    <span
      data-slot="ascii-badge"
      data-tone={tone}
      data-shape={shape}
      className={cn(
        "inline-flex shrink-0 items-baseline align-baseline font-medium whitespace-pre",
        className
      )}
      style={rootStyle}
      {...props}
    >
      {open ? (
        <span aria-hidden="true" className="select-none">
          {open}
        </span>
      ) : null}
      <span
        className={cn(
          "inline-flex items-baseline justify-center gap-[1ch]",
          !fixed && "px-[1ch]"
        )}
        style={{
          backgroundColor: inverse ? ink : undefined,
          minWidth: fixed ? `${Math.max(1, Math.round(width))}ch` : undefined,
        }}
      >
        {dot ? <LiveDot /> : null}
        <span>{children}</span>
      </span>
      {close ? (
        <span aria-hidden="true" className="select-none">
          {close}
        </span>
      ) : null}
    </span>
  );
};
