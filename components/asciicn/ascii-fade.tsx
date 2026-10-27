"use client";

import { useRef } from "react";
import type { CSSProperties, RefObject } from "react";

import {
  AsciiGrid,
  createToneField,
  cssColor,
  mapTones,
  resolveCharset,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiGridProps,
  AsciiHandle,
  CharsetName,
  DitherMatrix,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

export const FADE_SIDES = ["bottom", "top", "left", "right"] as const;
export type FadeSide = (typeof FADE_SIDES)[number];

export interface AsciiFadeProps extends Omit<
  AsciiGridProps,
  "draw" | "ink" | "paper" | "colored" | "fallback"
> {
  /** The edge of the parent the fade sits on; content fades out toward it. Default `"bottom"`. */
  side?: FadeSide;
  /** Depth of the fade in cells: rows for top and bottom, columns for left and right. Default 8. */
  size?: number;
  /** Which glyphs the fade steps through, from sparse to dense. Default `"blocks"` (` ░▒▓█`). */
  charset?: CharsetName;
  /** A custom ramp from empty to dense, such as `" ·:░▒▓█"`. Wins over `charset`. */
  chars?: string;
  /** Ordered dithering between glyph levels, which smooths the ramp. Default `"bayer4"`. */
  dither?: "none" | DitherMatrix;
  /** The colour content fades into: a palette name, a CSS variable name or any CSS colour. Default `"--ascii-paper"`. */
  color?: AsciiColor;
  /** The fade's inner edge wanders slowly through value noise. Default `true`. */
  drift?: boolean;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

// A float hash in [0, 1): cheap, stable for integer inputs, no bitwise maths.
const hash = (a: number, b: number): number => {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

/** Smooth 1D value noise along a line, in [0, 1]; `lane` picks the line. */
const noise = (x: number, lane: number): number => {
  const ix = Math.floor(x);
  const f = x - ix;
  const s = f * f * (3 - 2 * f);
  return hash(ix, lane) + (hash(ix + 1, lane) - hash(ix, lane)) * s;
};

const smoothstep = (value: number) => {
  const t = value > 0 ? Math.min(value, 1) : 0;
  return t * t * (3 - 2 * t);
};

const PLACEMENT = {
  bottom: "inset-x-0 bottom-0",
  left: "inset-y-0 left-0",
  right: "inset-y-0 right-0",
  top: "inset-x-0 top-0",
} as const satisfies Record<FadeSide, string>;

/** The one solid cell along the outer edge, under the densest glyphs. */
const SOLID = {
  bottom: "inset-x-0 bottom-0 h-[calc(var(--fade-cell)/2)]",
  left: "inset-y-0 left-0 w-[calc(var(--fade-cell)/4)]",
  right: "inset-y-0 right-0 w-[calc(var(--fade-cell)/4)]",
  top: "inset-x-0 top-0 h-[calc(var(--fade-cell)/2)]",
} as const satisfies Record<FadeSide, string>;

type FadeVars = CSSProperties & Record<"--fade-cell", string>;

/**
 * A section edge that fades content through a glyph density ramp into the
 * background: sparse glyphs in the page colour where the content still
 * shows, solid blocks at the edge. Absolutely positioned on one side of
 * its nearest positioned parent; decorative and click-through.
 */
export const AsciiFade = ({
  side = "bottom",
  size = 8,
  charset = "blocks",
  chars,
  dither = "bayer4",
  color = "--ascii-paper",
  drift = true,
  cell,
  fps = 20,
  className,
  style,
  ...props
}: AsciiFadeProps) => {
  const fieldRef = useRef<ToneField | null>(null);
  const keyRef = useRef("");
  const set = resolveCharset(charset, chars);
  const depth = Math.max(1, Math.round(size));
  const vertical = side === "top" || side === "bottom";
  const cellCss = cell === undefined ? "var(--ascii-cell, 12px)" : `${cell}px`;

  const draw = ({ frame, columns, rows, time }: AsciiGridDrawContext) => {
    const key = `${columns}x${rows}:${set.id}:${set.glyphs.length}`;
    if (!fieldRef.current || keyRef.current !== key) {
      fieldRef.current = createToneField(columns, rows, set);
      keyRef.current = key;
    }
    const field = fieldRef.current;
    const { width, height, tones } = field;
    const shift = drift ? time * 0.6 : 0;
    // Along: across the edge in samples. Depth: 0 at the content, 1 at the edge.
    const along = vertical ? width : height;
    const span = vertical ? height : width;
    const cellsAlong = vertical ? columns : rows;
    for (let a = 0; a < along; a += 1) {
      const position = (a / along) * cellsAlong;
      const wobble =
        (noise(position * 0.22 + shift, 1) - 0.5) * 0.28 +
        (noise(position * 0.6 - shift * 1.4, 2) - 0.5) * 0.12;
      for (let d = 0; d < span; d += 1) {
        const inward = (d + 0.5) / span;
        const outward =
          side === "bottom" || side === "right" ? inward : 1 - inward;
        const tone = smoothstep(outward * 1.12 - 0.06 + wobble);
        const index = vertical ? d * width + a : a * width + d;
        tones[index] = tone;
      }
    }
    mapTones(field, columns, rows, { charset: set, dither }, frame);
  };

  const vars: FadeVars = { "--fade-cell": cellCss };

  return (
    <div
      aria-hidden="true"
      data-slot="ascii-fade"
      data-side={side}
      className={cn("pointer-events-none absolute", PLACEMENT[side], className)}
      style={{
        ...vars,
        fontFamily: "var(--ascii-font, ui-monospace, monospace)",
        fontSize: `calc(${cellCss} / 1.2)`,
        ...(vertical
          ? { height: `calc(${cellCss} * ${depth})` }
          : { width: `${depth}ch` }),
        ...style,
      }}
    >
      <AsciiGrid
        draw={draw}
        ink={color}
        cell={cell}
        fps={fps}
        className="absolute inset-0"
        {...props}
      />
      <div
        className={cn("absolute", SOLID[side])}
        style={{ backgroundColor: cssColor(color) }}
      />
    </div>
  );
};
