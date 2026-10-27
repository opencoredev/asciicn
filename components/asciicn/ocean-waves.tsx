"use client";

import { useRef } from "react";
import type { ComponentProps, RefObject } from "react";

import {
  AsciiGrid,
  createToneField,
  mapTones,
  PHOSPHORS,
  resolveCharset,
  useAsciiColors,
} from "@/lib/ascii";
import type {
  AsciiGridDrawContext,
  AsciiHandle,
  Charset,
  CharsetName,
  MutableFrame,
  PhosphorName,
  PostFx,
  Rgb8,
  ToneField,
} from "@/lib/ascii";

/** `truecolor` keeps the night's colours; `mono` draws every glyph in the ink. */
export const OCEAN_COLOR_MODES = ["truecolor", "mono"] as const;
export type OceanColorMode = (typeof OCEAN_COLOR_MODES)[number];

export interface OceanWavesProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  /** How big the rolling swells are, from 0 (a flat calm) to 1 (heavy seas). Default 0.6. */
  swell?: number;
  /** How hard the wind blows, from 0 to 1: more chop, more foam on the crests, faster clouds. Default 0.4. */
  wind?: number;
  /** Show the moon and its glittering path on the water. Default `true`. */
  moon?: boolean;
  /** How much the scene shows, from 0 (empty paper) to 1. Lower it under body text. Default 1. */
  intensity?: number;
  /** Which glyphs draw the sky, clouds and water. Default `"standard"`. */
  charset?: CharsetName;
  /** A custom ramp from empty to dense, such as `" .oO@"`. Wins over `charset`. */
  chars?: string;
  /** Default `"truecolor"`, or `"mono"` with a phosphor. */
  colorMode?: OceanColorMode;
  /** A CRT ink and glass that replace the ink and paper. Default: none. */
  phosphor?: PhosphorName;
  /** `"transparent"` draws the glyphs only, over your own surface. Default `"paper"`. */
  background?: "paper" | "transparent";
  /** CRT finish drawn over the glyphs. Default: none. */
  fx?: PostFx;
  /** Cell height in CSS pixels. Default 12. */
  cell?: number;
  /** Time multiplier. Default 1. */
  speed?: number;
  /** `false` holds one still frame. Default `true`. */
  animate?: boolean;
  /** The moment drawn when motion is off or reduced, in seconds. Default 6. */
  stillTime?: number;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

/* -------------------------------------------------------------------------- */
/* Noise                                                                       */
/* -------------------------------------------------------------------------- */

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
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};

const fbm = (x: number, y: number): number =>
  (noise(x, y) * 0.5 +
    noise(x * 2.03 + 5.1, y * 2.03 + 1.7) * 0.25 +
    noise(x * 4.1 + 2.3, y * 4.1 + 8.9) * 0.125) /
  0.875;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

type Rgb = readonly [number, number, number];

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/* -------------------------------------------------------------------------- */
/* Scene                                                                       */
/* -------------------------------------------------------------------------- */

// World units: y is 0 at the bottom of the box and 1 at the top; x is
// centred and scaled by the box's true aspect. Below the horizon every
// sample is projected onto the sea: `z` is its distance out, and `wx` its
// sideways position on the water, so near swells are big and far ones
// crowd toward the horizon.

const HORIZON = 0.56;

const SKY_HIGH: Rgb = [10, 14, 34];
const SKY_LOW: Rgb = [30, 44, 86];
const MOON_COLOR: Rgb = [255, 248, 226];
const CLOUD_DARK: Rgb = [70, 82, 118];
const CLOUD_LIT: Rgb = [214, 222, 240];
const SEA_DEEP: Rgb = [22, 46, 84];
const SEA_LIT: Rgb = [96, 140, 186];
const FOAM: Rgb = [214, 232, 246];
const GLITTER: Rgb = [255, 244, 206];
const STAR: Rgb = [200, 210, 240];

interface OceanParams {
  time: number;
  swell: number;
  wind: number;
  moon: boolean;
  intensity: number;
  onLight: boolean;
}

/** Where the moon hangs, in world units. */
const moonAt = (aspect: number): readonly [number, number] => [
  aspect * 0.16,
  0.82,
];

/**
 * The sea surface at a point on the water, about -1 to 1: two long swells
 * rolling in toward the viewer, bent a little sideways, and wind chop on
 * top. Swells move toward the viewer, so their phase grows with time,
 * slowly: one long swell every six seconds or so, like a calm night.
 */
const seaHeight = (wx: number, z: number, params: OceanParams): number => {
  const { time, swell, wind } = params;
  const bend = 0.7 * Math.sin(wx * 2.1 + time * 0.08);
  const long = Math.sin((z / 0.1) * Math.PI * 2 + bend + time * 0.55);
  const cross = Math.sin(
    (z / 0.055 + wx / 0.2) * Math.PI * 2 + time * 0.85 + 1.3
  );
  const chop = noise(wx * 26 + time * 0.3, z * 40 - time * 0.9) - 0.5;
  return (
    (long * 0.7 + cross * 0.3) * lerp(0.25, 1, swell) +
    chop * (0.4 + wind * 1.2)
  );
};

interface Water {
  /** Distance out to sea; larger is further. */
  z: number;
  /** Sea surface height, about -1 to 1. */
  height: number;
  /** How close the moon's path is, 0 to 1. */
  path: number;
  /** 0 at the horizon, 1 at the bottom of the box. */
  near: number;
}

/** Project a point below the horizon onto the sea. */
const water = (
  x: number,
  y: number,
  aspect: number,
  params: OceanParams
): Water => {
  const below = HORIZON - y;
  const z = 0.07 / Math.max(below, 0.004);
  const wx = x * z;
  // Far out, the swells crowd closer than a glyph row; fade them into a
  // calm sheen so the horizon doesn't shimmer.
  const detail = smoothstep(3.2, 0.9, z);
  const height = seaHeight(wx, z, params) * detail;
  const moon = moonAt(aspect);
  // The moon's path widens toward the viewer and wavers with the swell.
  const width = 0.02 + below * 0.32;
  const waver = 0.025 * Math.sin(z * 30 + params.time * 0.4) * below * 3;
  const path = params.moon
    ? 1 - smoothstep(width * 0.4, width, Math.abs(x - moon[0] + waver))
    : 0;
  return { height, near: below / HORIZON, path, z };
};

/**
 * Fill the tone field: the night sky with its stars, moon and clouds, then
 * the sea, where the light catches the swell faces, foam rides the crests
 * and the moon's path glitters.
 */
// oxlint-disable-next-line complexity -- one pass over every sample.
const paintField = (field: ToneField, aspect: number, params: OceanParams) => {
  const { width, height, tones, colors } = field;
  const { time, wind } = params;
  const pixel = 1 / height;
  const moon = moonAt(aspect);
  const drift = time * (0.01 + wind * 0.03);
  let color: Rgb = SKY_HIGH;

  for (let sy = 0; sy < height; sy += 1) {
    const y = 1 - (sy + 0.5) / height;
    const sky = mixRgb(SKY_LOW, SKY_HIGH, smoothstep(HORIZON, 1, y));
    for (let sx = 0; sx < width; sx += 1) {
      const x = ((sx + 0.5) / width - 0.5) * aspect;
      let tone = 0;
      color = sky;
      if (y >= HORIZON) {
        // A thin glow along the horizon, brightest under the moon.
        const glowAbove = Math.exp(-(y - HORIZON) * 40);
        tone = glowAbove * 0.12;
        if (params.moon) {
          const dx = x - moon[0];
          const dy = y - moon[1];
          const rm = Math.hypot(dx, dy);
          if (rm < 0.3) {
            const r = 0.06;
            const disc = 1 - smoothstep(r - pixel, r + pixel, rm);
            const sea = smoothstep(0.52, 0.7, fbm(dx * 55 + 7, dy * 55 + 2));
            const halo = Math.exp(-Math.max(rm - r, 0) * 20) * (1 - disc);
            color = mixRgb(color, MOON_COLOR, Math.max(disc, halo * 0.6));
            tone = Math.max(tone, disc * (0.9 - 0.25 * sea), halo * 0.2);
          }
        }
        // Faint stars, kept away from the moon's glare.
        if (hash(sx, sy) < 0.012 && y > HORIZON + 0.06) {
          const glare = params.moon
            ? smoothstep(0.12, 0.35, Math.hypot(x - moon[0], y - moon[1]))
            : 1;
          const star = (hash(sx + 3, sy) < 0.2 ? 0.56 : 0.13) * glare;
          if (star > tone) {
            tone = star;
            color = STAR;
          }
        }
        // Clouds in long ragged bands, drifting with the wind. Their edges
        // catch the moonlight; one passing in front dims the moon.
        const band =
          smoothstep(HORIZON + 0.08, HORIZON + 0.2, y) *
          (1 - smoothstep(0.86, 1, y));
        const n = fbm(x * 1.4 - drift * 3, y * 9 + 3);
        const cloud = smoothstep(0.6, 0.8, n) * band;
        if (cloud > 0.02) {
          const lit = params.moon
            ? Math.exp(-Math.hypot(x - moon[0], y - moon[1]) * 3)
            : 0.2;
          const shade = mixRgb(CLOUD_DARK, CLOUD_LIT, lit * (1 - cloud * 0.6));
          color = mixRgb(color, shade, Math.min(1, cloud * 1.4));
          tone = lerp(
            tone,
            0.1 + 0.2 * cloud * (0.4 + lit),
            Math.min(1, cloud * 1.6)
          );
        }
      } else {
        const w = water(x, y, aspect, params);
        // Swell faces lit by the sky and moon; troughs stay dark.
        const face = smoothstep(-0.1, 0.9, w.height);
        tone = lerp(0.09, 0.3, face) * lerp(0.6, 1, w.near);
        color = mixRgb(SEA_DEEP, SEA_LIT, face * lerp(0.5, 1, w.near));
        // Foam on the crests, more of it in the wind and nearer the eye.
        const foamAt = lerp(0.95, 0.55, params.wind) - 0.15 * w.near;
        if (w.height > foamAt) {
          const froth = smoothstep(foamAt, foamAt + 0.25, w.height);
          tone = Math.max(tone, lerp(0.3, 0.62, froth));
          color = mixRgb(color, FOAM, froth);
        }
        // The moon's path: glints shimmer where a wave face catches it.
        // Each sample changes on its own beat, about once a second, so the
        // path glitters rather than flashing all at once.
        if (w.path > 0) {
          const glint = hash(
            sx * 7 + Math.floor(time * 1.1 + hash(sx, sy + 17)),
            sy * 3 + Math.floor(w.z * 40)
          );
          const lit = w.path * smoothstep(0.1, 0.8, w.height + 0.5 * glint);
          if (glint < 0.55 * w.path) {
            tone = Math.max(tone, lit > 0.5 ? 0.7 : 0.34);
            color = mixRgb(color, GLITTER, Math.max(0.6, lit));
          } else {
            color = mixRgb(color, SEA_LIT, w.path * 0.5);
            tone = Math.max(tone, 0.12 * w.path);
          }
        }
      }

      const index = sy * width + sx;
      const shown = tone * params.intensity;
      tones[index] = shown < 0.04 ? 0 : shown;
      if (colors) {
        // Pale foam and moonlight vanish on a light paper; darken the
        // light colours most so the sea keeps its blue.
        const l =
          (0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]) / 255;
        const scale = params.onLight ? lerp(0.85, 0.45, l) : 1;
        const at = index * 4;
        colors[at] = color[0] * scale;
        colors[at + 1] = color[1] * scale;
        colors[at + 2] = color[2] * scale;
        colors[at + 3] = 255;
      }
    }
  }
};

const FOAM_GLYPHS = ["*", "'", ".", "`", ",", "^"] as const;

/**
 * Wave crests as line glyphs, for ramps only: a run of `~` along every
 * swell crest, bursting into `*`, `'` and `.` where it breaks into foam,
 * and `*` and `+` glints along the moon's path. Braille and quadrant sets
 * already draw all of this from the tone field.
 */
const drawCrests = (
  frame: MutableFrame,
  columns: number,
  rows: number,
  aspect: number,
  params: OceanParams,
  paper: Rgb8
) => {
  const horizonRow = (1 - HORIZON) * rows;
  const fade = (color: Rgb, amount: number): Rgb => {
    const l = (0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]) / 255;
    const lit = params.onLight ? mixRgb(color, [0, 0, 0], l * 0.5) : color;
    return mixRgb(paper, lit, amount * params.intensity);
  };
  for (let cy = Math.ceil(horizonRow); cy < rows; cy += 1) {
    const y = 1 - (cy + 0.5) / rows;
    const yAbove = 1 - cy / rows;
    for (let cx = 0; cx < columns; cx += 1) {
      const x = ((cx + 0.5) / columns - 0.5) * aspect;
      const here = water(x, y, aspect, params);
      // A crest crosses this cell when the surface rises through it from
      // the row below to the row above.
      const above = water(x, Math.min(yAbove, HORIZON - 0.001), aspect, params);
      const crest = here.height > 0.22 && above.height < here.height + 0.05;
      const foamAt = lerp(0.95, 0.55, params.wind) - 0.15 * here.near;
      const strength = lerp(0.45, 1, here.near);
      const seed = hash(
        cx * 13 + Math.floor(params.time * 1.1 + hash(cx, cy + 17)),
        cy
      );
      if (here.path > 0.3 && seed < 0.3 * here.path) {
        frame.put(cx, cy, seed < 0.1 ? "*" : "+", fade(GLITTER, 1));
      } else if (here.height > foamAt && here.near > 0.15) {
        // Breaking: the crest comes apart into lighter and lighter glyphs.
        const froth = smoothstep(foamAt, foamAt + 0.4, here.height);
        const pick = Math.floor(seed * (2 + froth * 4)) % FOAM_GLYPHS.length;
        frame.put(
          cx,
          cy,
          FOAM_GLYPHS[pick] ?? "*",
          fade(FOAM, lerp(0.6, 1, froth))
        );
      } else if (crest) {
        frame.put(
          cx,
          cy,
          here.near < 0.12 ? "-" : "~",
          fade(mixRgb(SEA_LIT, FOAM, here.path * 0.6 + 0.2), strength)
        );
      }
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

const toBytes = (rgba: readonly number[] | undefined, fallback: Rgb8): Rgb8 =>
  rgba
    ? [
        Math.round((rgba[0] ?? 0) * 255),
        Math.round((rgba[1] ?? 0) * 255),
        Math.round((rgba[2] ?? 0) * 255),
      ]
    : fallback;

/**
 * Ocean waves. A moonlit sea at night: long swells rolling in toward the
 * viewer with `~` along their crests, foam that breaks into lighter glyphs
 * as the crests spill, a full moon with a path of glints on the water, and
 * clouds drifting past. Drawn on the CPU: the sky, clouds and water shading
 * go through the charset's ramp, and ramps get line glyphs for crests and
 * foam on top. It does not react to the pointer. Decorative: size it with
 * `className`, usually `absolute inset-0`.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const OceanWaves = ({
  swell = 0.6,
  wind = 0.4,
  moon = true,
  intensity = 1,
  charset = "standard",
  chars,
  colorMode,
  phosphor,
  background = "paper",
  fx,
  cell = 12,
  speed = 1,
  animate = true,
  stillTime = 6,
  handle,
  ...props
}: OceanWavesProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const preset = phosphor ? PHOSPHORS[phosphor] : undefined;
  const mode = colorMode ?? (preset ? "mono" : "truecolor");
  const theme = useAsciiColors(rootRef, [preset?.paper ?? "--ascii-paper"]);
  const fieldRef = useRef<ToneField | null>(null);
  const resolved: Charset = resolveCharset(charset, chars);
  const packed = resolved.kind === "braille" || resolved.kind === "quadrants";

  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    time,
  }: AsciiGridDrawContext) => {
    const paper = toBytes(theme?.[0], [0, 0, 0]);
    const onLight =
      preset === undefined &&
      (0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2]) / 255 > 0.55;
    const [gx, gy] = resolved.grid;
    let field = fieldRef.current;
    if (!field || field.width !== columns * gx || field.height !== rows * gy) {
      field = createToneField(columns, rows, resolved, { color: true });
      fieldRef.current = field;
    }
    const aspect =
      (columns * metrics.width) / Math.max(1, rows * metrics.height);
    const params: OceanParams = {
      intensity: clamp(intensity, 0, 1),
      moon,
      onLight,
      swell: clamp(swell, 0, 1),
      time,
      wind: clamp(wind, 0, 1),
    };
    paintField(field, aspect, params);
    mapTones(
      field,
      columns,
      rows,
      {
        charset: resolved,
        colorMode: mode === "mono" ? "mono" : "truecolor",
        dither: packed ? "blue-noise" : "none",
      },
      frame
    );
    if (resolved.kind === "ramp" && params.intensity > 0.04) {
      drawCrests(frame, columns, rows, aspect, params, paper);
    }
  };

  return (
    <AsciiGrid
      ref={rootRef}
      draw={draw}
      cell={cell}
      ink={preset?.ink ?? "--ascii-ink"}
      paper={
        background === "transparent"
          ? "transparent"
          : (preset?.paper ?? "--ascii-paper")
      }
      colored={mode === "truecolor"}
      speed={speed}
      animate={animate}
      fps={30}
      stillTime={stillTime}
      handle={handle}
      fx={fx}
      {...props}
    />
  );
};
