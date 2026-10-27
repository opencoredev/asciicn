"use client";

import { useRef } from "react";
import type { RefObject } from "react";

import {
  AsciiGrid,
  createToneField,
  mapTones,
  resolveCharset,
  useAsciiColors,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiGridProps,
  AsciiHandle,
  CharsetName,
  DitherMatrix,
  Rgba,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/** A point in the box: x from the left, y from the top, both 0 to 1. */
export type GlowPoint = readonly [number, number];

export const GLOW_POSITIONS = [
  "top",
  "bottom",
  "left",
  "right",
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

/** Where the glow sits: an edge, a corner, the centre, or any point. */
export type GlowPosition = (typeof GLOW_POSITIONS)[number] | GlowPoint;

const POSITIONS = {
  bottom: [0.5, 1.05],
  "bottom-left": [0, 1],
  "bottom-right": [1, 1],
  center: [0.5, 0.5],
  left: [-0.05, 0.5],
  right: [1.05, 0.5],
  top: [0.5, -0.05],
  "top-left": [0, 0],
  "top-right": [1, 0],
} as const satisfies Record<(typeof GLOW_POSITIONS)[number], GlowPoint>;

export interface AsciiGlowProps extends Omit<
  AsciiGridProps,
  "draw" | "ink" | "paper" | "colored" | "fallback"
> {
  /** Where the light comes from. Default `"top"`. */
  position?: GlowPosition;
  /** How far the light reaches; 1 reaches the farthest corner. Default 0.7. */
  radius?: number;
  /** Brightness at the centre, 0 (none) to 1 (densest glyph). Default 0.8. */
  intensity?: number;
  /** Which glyphs draw the light, from sparse to dense. Default `"standard"`. */
  charset?: CharsetName;
  /** A custom ramp from empty to dense, such as `" .:+#"`. Wins over `charset`. */
  chars?: string;
  /** Ordered dithering between glyph levels, which softens the falloff. Default `"bayer4"`. */
  dither?: "none" | DitherMatrix;
  /** Glyph colour: a palette name, a CSS variable name or any CSS colour. Default `"ink"`. */
  color?: AsciiColor;
  /** `palette` fades faint glyphs toward `--ascii-paper` for a softer edge; `mono` draws every glyph in `color`. Default `"palette"`. */
  colorMode?: "palette" | "mono";
  /** Slow drift of the light's edge through value noise. Default `true`. */
  drift?: boolean;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

const resolvePosition = (position: GlowPosition): GlowPoint =>
  typeof position === "string" ? POSITIONS[position] : position;

// A float hash in [0, 1): cheap, stable for integer inputs, no bitwise maths.
const hash = (a: number, b: number): number => {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

/** Smooth value noise in [0, 1]. */
const noise = (x: number, y: number): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * sx;
  const bottom =
    hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * sx;
  return top + (bottom - top) * sy;
};

const toBytes = ([r, g, b]: Rgba): readonly [number, number, number] => [
  Math.round(r * 255),
  Math.round(g * 255),
  Math.round(b * 255),
];

/**
 * A glowing aura drawn in glyphs: a soft light from an edge, a corner or
 * any point, falling off through a glyph ramp with ordered dithering
 * between levels, its edge drifting slowly. Decorative and full-bleed:
 * size it with `className`, usually `absolute inset-0`.
 */
export const AsciiGlow = ({
  position = "top",
  radius = 0.7,
  intensity = 0.8,
  charset = "standard",
  chars,
  dither = "bayer4",
  color = "ink",
  colorMode = "palette",
  drift = true,
  fps = 24,
  className,
  ...props
}: AsciiGlowProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const colors = useAsciiColors(rootRef, ["--ascii-paper", color]);
  const fieldRef = useRef<ToneField | null>(null);
  const keyRef = useRef("");
  const set = resolveCharset(charset, chars);
  const [cx, cy] = resolvePosition(position);
  const reachShare = Math.max(0.05, radius);

  const draw = ({
    frame,
    columns,
    rows,
    time,
    metrics,
  }: AsciiGridDrawContext) => {
    const key = `${columns}x${rows}:${set.id}:${set.glyphs.length}`;
    if (!fieldRef.current || keyRef.current !== key) {
      fieldRef.current = createToneField(columns, rows, set);
      keyRef.current = key;
    }
    const field = fieldRef.current;
    const { width, height, tones } = field;
    const [gx, gy] = set.grid;
    // Work in CSS pixels so the light stays round in cells of any aspect.
    const boxWidth = columns * metrics.width;
    const boxHeight = rows * metrics.height;
    const centerX = cx * boxWidth;
    const centerY = cy * boxHeight;
    const farX = Math.max(centerX, boxWidth - centerX);
    const farY = Math.max(centerY, boxHeight - centerY);
    const reach = Math.hypot(farX, farY) * reachShare;
    const breathe = drift ? 1 + 0.05 * Math.sin(time * 0.4) : 1;
    const scale = 1 / (reach * breathe);
    const shift = drift ? time * 0.12 : 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        // One noise value per cell warps every sample in it.
        const warp =
          (noise(column * 0.09 + shift, row * 0.18 - shift * 0.6) - 0.5) * 0.3;
        for (let sy = 0; sy < gy; sy += 1) {
          const y = row * gy + sy;
          const py = ((y + 0.5) / height) * boxHeight - centerY;
          for (let sx = 0; sx < gx; sx += 1) {
            const x = column * gx + sx;
            const px = ((x + 0.5) / width) * boxWidth - centerX;
            const d = Math.max(0, Math.hypot(px, py) * scale + warp);
            const core = Math.exp(-d * d * 4.5);
            const halo =
              Math.exp(-d * 2.4) *
              (1 - Math.min(1, Math.max(0, (d - 0.6) / 0.7)));
            tones[y * width + x] = intensity * (core * 0.62 + halo * 0.38);
          }
        }
      }
    }
    const palette =
      colorMode === "palette" && colors
        ? [toBytes(colors[0]), toBytes(colors[1])]
        : undefined;
    mapTones(
      field,
      columns,
      rows,
      {
        charset: set,
        colorMode: palette ? "palette" : "mono",
        dither,
        palette,
      },
      frame
    );
  };

  return (
    <AsciiGrid
      ref={rootRef}
      draw={draw}
      ink={color}
      colored={colorMode === "palette"}
      fps={fps}
      className={cn(
        "transition-opacity duration-500 data-[state=fallback]:opacity-0",
        className
      )}
      {...props}
    />
  );
};
