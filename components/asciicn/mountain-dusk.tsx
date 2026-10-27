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

/** `truecolor` keeps the sky's colours; `mono` draws every glyph in the ink. */
export const DUSK_COLOR_MODES = ["truecolor", "mono"] as const;
export type DuskColorMode = (typeof DUSK_COLOR_MODES)[number];

export interface MountainDuskProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  /** Where the evening is, from 0 (the sun setting) to 1 (full night, moon high). Default 0.35. */
  time?: number;
  /** How many ridgelines stand before the horizon, 1 to 6. Default 5. */
  layers?: number;
  /** How many stars come out, from 0 (none, and no shooting stars) to 1. Default 0.7. */
  stars?: number;
  /** How much mist lies in the valleys, from 0 to 1. Default 0.7. */
  mist?: number;
  /** Show the rising moon. Default `true`. */
  moon?: boolean;
  /** How much the scene shows, from 0 (empty paper) to 1. Lower it under body text. Default 1. */
  intensity?: number;
  /** Ridges slide apart as the pointer moves, nearest most. Default `true`. */
  interactive?: boolean;
  /** Which glyphs draw the haze, sky and mist. Default `"standard"`. */
  charset?: CharsetName;
  /** A custom ramp from empty to dense, such as `" .oO@"`. Wins over `charset`. */
  chars?: string;
  /** Default `"truecolor"`, or `"mono"` with a phosphor. */
  colorMode?: DuskColorMode;
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
  /** The moment drawn when motion is off or reduced, in seconds. Default 14. */
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

/* -------------------------------------------------------------------------- */
/* Scene                                                                       */
/* -------------------------------------------------------------------------- */

// World units: y is 0 at the bottom of the box and 1 at the top; x is
// centred and scaled by the box's true aspect, so shapes keep their
// proportions at any size.

/**
 * The crest of one ridge at x: a row of peaks, each a steep-sided triangle
 * with its own height and lean, roughened by noise. Far ridges (depth 0)
 * stand high with small peaks; near ridges (depth 1) sit low and rise in
 * big, wide mountains.
 */
const crestAt = (x: number, depth: number, layer: number): number => {
  const base = lerp(0.36, -0.02, depth);
  const amp = lerp(0.22, 0.34, depth);
  const width = lerp(0.2, 0.5, depth);
  const k = Math.floor(x / width);
  let peak = 0;
  for (let j = -1; j <= 1; j += 1) {
    const id = k + j;
    const cx = (id + 0.2 + 0.6 * hash(id, layer * 7 + 3)) * width;
    const h = 0.4 + 0.6 * hash(id, layer * 7 + 4);
    const lean = 0.65 + 0.7 * hash(id, layer * 7 + 5);
    const dx = x - cx;
    const side = dx < 0 ? lean : 2 - lean;
    peak = Math.max(peak, h - (Math.abs(dx) / width) * 1.7 * side);
  }
  const rough =
    0.07 * (noise((x * 7) / width, layer * 13) - 0.5) +
    0.035 * (noise((x * 23) / width, layer * 5 + 2) - 0.5);
  return base + amp * (Math.max(peak, -0.25) + rough);
};

type Rgb = readonly [number, number, number];

const mixRgb = (a: Rgb | Rgb8, b: Rgb | Rgb8, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// Colours in bytes, sunset then night.
const SKY = {
  duskHigh: [56, 44, 108],
  duskLow: [255, 143, 82],
  duskMid: [220, 102, 133],
  nightHigh: [22, 26, 66],
  nightLow: [50, 62, 128],
} as const satisfies Record<string, Rgb8>;
const RIDGE = {
  farDusk: [250, 168, 168],
  farNight: [128, 143, 210],
  nearDusk: [84, 56, 120],
  nearNight: [40, 44, 96],
  rimDusk: [255, 186, 132],
  rimNight: [196, 214, 255],
} as const satisfies Record<string, Rgb8>;
const SUN: Rgb8 = [255, 214, 150];
const MOON: Rgb8 = [255, 250, 230];
const STAR: Rgb8 = [222, 230, 255];
const WARM_STAR: Rgb8 = [255, 226, 186];
const MIST_DUSK: Rgb8 = [250, 200, 205];
const MIST_NIGHT: Rgb8 = [164, 178, 230];

interface DuskParams {
  /** Seconds of motion. */
  time: number;
  /** How dark it is, 0 (sunset) to 1, already eased. */
  night: number;
  layers: number;
  stars: number;
  mist: number;
  moon: boolean;
  intensity: number;
  /** Pointer offset from the centre, -0.5 to 0.5 on each axis, y up. */
  pointer: readonly [number, number];
  /** Darken light colours so they show on a light paper. */
  onLight: boolean;
}

/** The ridges' depths, far to near. With fewer ridges the far ones go first. */
const depths = (count: number): number[] =>
  Array.from({ length: count }, (_, i) =>
    count > 1 ? lerp(1 - (count - 1) / 5, 1, i / (count - 1)) : 1
  );

/** Each ridge drifts slowly and follows the pointer, nearer ones further. */
const shiftFor = (depth: number, params: DuskParams): number =>
  params.time * 0.006 * lerp(0.15, 1, depth) +
  params.pointer[0] * lerp(0.015, 0.09, depth);

const liftFor = (depth: number, params: DuskParams): number =>
  params.pointer[1] * lerp(0.004, 0.02, depth);

const sunAt = (aspect: number, night: number): readonly [number, number] => [
  -aspect * 0.17,
  lerp(0.66, 0.1, smoothstep(0, 0.75, night)),
];

const moonAt = (aspect: number, night: number): readonly [number, number] => [
  aspect * 0.24,
  lerp(0.48, 0.84, smoothstep(0.2, 1, night)),
];

/**
 * Now and then a shooting star, once the sky is dark enough: a bright head
 * with a fading tail. Returns its tone at a point for this moment, or null.
 */
const shootingStar = (time: number, aspect: number, params: DuskParams) => {
  const slot = Math.floor(time / 6);
  const when = time - slot * 6;
  if (params.night < 0.3 || when > 0.9 || hash(slot, 4) > 0.65 * params.stars) {
    return null;
  }
  const startX = (hash(slot, 1) - 0.6) * aspect * 0.8;
  const startY = 0.8 + 0.15 * hash(slot, 2);
  const slant = -0.35 - 0.3 * hash(slot, 3);
  const length = Math.hypot(1, slant);
  const dirX = 1 / length;
  const dirY = slant / length;
  const headX = startX + dirX * when * 0.5;
  const headY = startY + dirY * when * 0.5;
  const tail = 0.18 * (1 - when / 1.2);
  return (x: number, y: number, pixel: number): number => {
    const rx = x - headX;
    const ry = y - headY;
    const along = -(rx * dirX + ry * dirY);
    const across = Math.abs(rx * dirY - ry * dirX);
    if (along < -pixel || along > tail || across > pixel * 0.6) {
      return 0;
    }
    return lerp(0.2, 0.9, 1 - along / tail) * (1 - when / 1.8);
  };
};

/**
 * Fill the tone field: sky, sun, moon and stars, then every ridge far to
 * near with the mist that pools in front of it. Tones run 0 (empty) to 1.
 */
// oxlint-disable-next-line complexity -- one pass over every sample, layer by layer.
const paintField = (
  field: ToneField,
  aspect: number,
  params: DuskParams,
  packed: boolean
) => {
  const { width, height, tones, colors } = field;
  const { night, time } = params;
  const pixel = 1 / height;
  const ridges = depths(params.layers);
  // Crest heights per sample column, per ridge.
  const crests = ridges.map((depth, layer) => {
    const row = new Float32Array(width);
    const shift = shiftFor(depth, params);
    const lift = liftFor(depth, params);
    for (let sx = 0; sx < width; sx += 1) {
      const x = ((sx + 0.5) / width - 0.5) * aspect;
      row[sx] = crestAt(x + shift, depth, layer) - lift;
    }
    return row;
  });
  const sun = sunAt(aspect, night);
  const moon = moonAt(aspect, night);
  const moonRise = smoothstep(0.2, 1, night);
  const mistColor = mixRgb(MIST_DUSK, MIST_NIGHT, night);
  const rim = mixRgb(RIDGE.rimDusk, RIDGE.rimNight, night);
  const bodies = ridges.map((depth) =>
    mixRgb(
      mixRgb(RIDGE.farDusk, RIDGE.nearDusk, depth),
      mixRgb(RIDGE.farNight, RIDGE.nearNight, depth),
      night
    )
  );
  const shoot = shootingStar(time, aspect, params);
  let color: Rgb = [0, 0, 0];

  for (let sy = 0; sy < height; sy += 1) {
    const y = 1 - (sy + 0.5) / height;
    const h = clamp((y - 0.42) / 0.58, 0, 1);
    // The sky behind this row: warm at the horizon, violet, then deep blue.
    let dusk = mixRgb(SKY.duskLow, SKY.duskMid, smoothstep(0, 0.2, h));
    dusk = mixRgb(dusk, SKY.duskHigh, smoothstep(0.15, 0.75, h));
    const deep = mixRgb(SKY.nightLow, SKY.nightHigh, smoothstep(0, 0.6, h));
    const sky = mixRgb(dusk, deep, night);
    const glow = Math.exp(-h * 9) * (1 - 0.7 * night) * 0.1;

    for (let sx = 0; sx < width; sx += 1) {
      const x = ((sx + 0.5) / width - 0.5) * aspect;
      let tone = glow;
      color = sky;

      // The sun, low on the left, sinking behind the far ridges.
      const rs = Math.hypot(x - sun[0], y - sun[1]);
      if (rs < 0.3) {
        const disc = 1 - smoothstep(0.05 - pixel, 0.05 + pixel, rs);
        const halo =
          Math.exp(-Math.max(rs - 0.05, 0) * 18) *
          (1 - smoothstep(0.25, 0.7, night));
        color = mixRgb(color, SUN, Math.max(disc, halo * 0.8));
        tone =
          Math.max(tone, disc * 0.82, halo * 0.26) *
          (1 - smoothstep(0.5, 0.8, night));
      }
      // The moon, rising on the right: a waxing gibbous with grey seas.
      if (params.moon && moonRise > 0) {
        const dx = x - moon[0];
        const dy = y - moon[1];
        const rm = Math.hypot(dx, dy);
        if (rm < 0.2) {
          const r = 0.052;
          const body = 1 - smoothstep(r - pixel, r + pixel, rm);
          const shadow =
            1 -
            smoothstep(
              r * 0.95 - pixel,
              r * 0.95 + pixel,
              Math.hypot(dx - r * 0.62, dy)
            );
          const lit = body * (1 - shadow * 0.85);
          const sea = smoothstep(0.55, 0.72, fbm(dx * 70 + 3, dy * 70));
          const halo =
            Math.exp(-Math.max(rm - r, 0) * 22) *
            (1 - body) *
            smoothstep(0, 0.3, moonRise);
          color = mixRgb(color, MOON, Math.max(lit, halo * 0.7));
          tone = Math.max(tone, lit * (0.88 - 0.2 * sea), halo * 0.2);
        }
      }
      // Stars, one sample each, so a star is one glyph or one Braille dot.
      // A few bright ones come out first; the faint ones follow.
      if (h > 0.05 && hash(sx, sy) < 0.03 * params.stars) {
        const magnitude = hash(sx + 7, sy + 3);
        const out = smoothstep(
          0.1 + magnitude * 0.6,
          0.25 + magnitude * 0.6,
          night
        );
        const twinkle = Math.sin(
          time * (1.2 + hash(sx, sy + 5) * 2) + magnitude * 40
        );
        // Stars pop in rather than fade, and twinkle by stepping down one
        // glyph, so each stays a clean dot, plus or asterisk.
        const faint = packed ? 0.55 : 0.12;
        let bright = faint;
        if (magnitude < 0.12) {
          bright = twinkle > -0.6 ? 0.72 : 0.56;
        } else if (magnitude < 0.35) {
          bright = twinkle > -0.85 ? 0.56 : faint;
        }
        const shown = out > 0.5 && h > 0.08 ? bright : 0;
        if (shown > tone) {
          tone = shown;
          color = hash(sx, sy + 11) > 0.75 ? WARM_STAR : STAR;
        }
      }
      if (shoot) {
        const streak = shoot(x, y, pixel);
        if (streak > tone) {
          tone = streak;
          color = MOON;
        }
      }

      // Ridges, far to near. Each is lit along its crest and falls away
      // into haze below, so the ridge in front stands out against the foot
      // of the one behind it.
      for (let layer = 0; layer < ridges.length; layer += 1) {
        const depth = ridges[layer] ?? 1;
        const d = (crests[layer]?.[sx] ?? 0) - y;
        if (d >= 0) {
          const lit = Math.exp(-d / lerp(0.05, 0.09, depth));
          tone = lerp(lerp(0.1, 0.03, depth), lerp(0.38, 0.26, depth), lit);
          // Braille and quadrants get no line glyphs, so the crest itself
          // is drawn as a solid row of dots.
          if (packed && d < pixel * 1.5) {
            tone = 0.9;
          }
          // The side facing the sun is warmer while it is still up.
          const sunSide =
            Math.exp(-Math.abs(x - sun[0]) * 2.5) * (1 - night) * 0.4;
          color = mixRgb(
            bodies[layer] ?? rim,
            rim,
            lit * (lerp(0.55, 0.3, depth) + sunSide)
          );
        }
        // Mist in front of this ridge, hidden by the next one except where
        // that ridge dips: the valleys.
        if (layer < ridges.length - 1 && params.mist > 0) {
          const bandY = lerp(0.36, -0.02, depth) + 0.08;
          const band = Math.exp(-(((y - bandY) / 0.05) ** 2));
          if (band > 0.02) {
            const n = fbm(
              x * 3 - time * (0.03 + 0.03 * depth) + layer * 4,
              y * 14
            );
            const haze = band * smoothstep(0.4, 0.68, n) * params.mist;
            if (haze > 0.02) {
              color = mixRgb(color, mistColor, haze * 0.85);
              tone = Math.max(tone, haze * 0.36);
            }
          }
        }
      }

      const index = sy * width + sx;
      const shown = tone * params.intensity;
      tones[index] = shown < 0.04 ? 0 : shown;
      if (colors) {
        // Pale haze and moonlight vanish on a light paper; darken the
        // light colours most so the sunset keeps its hue.
        const l =
          (0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]) / 255;
        const scale = params.onLight ? lerp(1, 0.5, l) : 1;
        const at = index * 4;
        colors[at] = color[0] * scale;
        colors[at + 1] = color[1] * scale;
        colors[at + 2] = color[2] * scale;
        colors[at + 3] = 255;
      }
    }
  }
};

/** The line glyph for a crest crossing one cell, from its rows at the cell's left edge, centre and right edge. */
const crestGlyph = (left: number, mid: number, right: number): string => {
  if (mid < left - 0.3 && mid < right - 0.3) {
    return "^";
  }
  if (right - left > 0.45) {
    return "\\";
  }
  if (left - right > 0.45) {
    return "/";
  }
  return mid - Math.floor(mid) > 0.55 ? "_" : "-";
};

/**
 * Ridgelines as line glyphs: `/` up a slope, `\` down one, `_` and `-` on
 * the flats and `^` on a sharp peak. Only for ramps; Braille and quadrant
 * sets already draw the crest at full resolution from the tone field.
 */
const drawCrests = (
  frame: MutableFrame,
  columns: number,
  rows: number,
  aspect: number,
  params: DuskParams,
  paper: Rgb8
) => {
  const ridges = depths(params.layers);
  // Crest rows (top-down, fractional) at the left edge, centre and right
  // edge of every cell column, per ridge.
  const edges = ridges.map((depth, layer) => {
    const shift = shiftFor(depth, params);
    const lift = liftFor(depth, params);
    const at = new Float32Array(columns * 2 + 1);
    for (let i = 0; i <= columns * 2; i += 1) {
      const x = (i / (columns * 2) - 0.5) * aspect;
      at[i] = (1 - (crestAt(x + shift, depth, layer) - lift)) * rows;
    }
    return at;
  });
  const rim = mixRgb(RIDGE.rimDusk, RIDGE.rimNight, params.night);
  for (let layer = 0; layer < ridges.length; layer += 1) {
    const depth = ridges[layer] ?? 1;
    const line = edges[layer];
    if (!line) {
      continue;
    }
    const body = mixRgb(
      mixRgb(RIDGE.farDusk, RIDGE.nearDusk, depth),
      mixRgb(RIDGE.farNight, RIDGE.nearNight, depth),
      params.night
    );
    let tint = mixRgb(body, rim, lerp(0.95, 0.65, depth));
    if (params.onLight) {
      const l = (0.2126 * tint[0] + 0.7152 * tint[1] + 0.0722 * tint[2]) / 255;
      tint = mixRgb(tint, [0, 0, 0], l * 0.5);
    }
    const shown: Rgb8 = mixRgb(paper, tint, params.intensity);
    for (let cx = 0; cx < columns; cx += 1) {
      const left = line[cx * 2] ?? 0;
      const mid = line[cx * 2 + 1] ?? 0;
      const right = line[cx * 2 + 2] ?? 0;
      // A nearer ridge whose crest is above this cell hides it.
      let cover = Number.POSITIVE_INFINITY;
      for (let near = layer + 1; near < ridges.length; near += 1) {
        cover = Math.min(cover, edges[near]?.[cx * 2 + 1] ?? cover);
      }
      // Gentle slopes take one glyph per column, at the crest's centre;
      // steep ones fill every row the crest crosses.
      const span = Math.max(left, mid, right) - Math.min(left, mid, right);
      const first = Math.floor(span < 1.6 ? mid : Math.min(left, mid, right));
      const last =
        span < 1.6
          ? first
          : Math.min(Math.floor(Math.max(left, mid, right)), first + 3);
      for (let cy = first; cy <= last; cy += 1) {
        if (cy < 0 || cy >= rows || cover <= cy + 0.15) {
          continue;
        }
        const glyph = crestGlyph(left, mid, right);
        frame.put(cx, cy, glyph, shown);
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
 * Mountain dusk. Layered ridgelines fading into haze, a low sun sinking
 * behind the far ridge, the moon rising on the other side, stars coming
 * out with the occasional shooting star, and mist in the valleys. Drawn on
 * the CPU: the sky, haze and mist go through the charset's ramp, and the
 * ridgelines are drawn with real line glyphs. The ridges drift slowly and
 * slide apart with the pointer, nearest most. Decorative: size it with
 * `className`, usually `absolute inset-0`.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const MountainDusk = ({
  time = 0.35,
  layers = 5,
  stars = 0.7,
  mist = 0.7,
  moon = true,
  intensity = 1,
  interactive = true,
  charset = "standard",
  chars,
  colorMode,
  phosphor,
  background = "paper",
  fx,
  cell = 12,
  speed = 1,
  animate = true,
  stillTime = 14,
  handle,
  ...props
}: MountainDuskProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const preset = phosphor ? PHOSPHORS[phosphor] : undefined;
  const mode = colorMode ?? (preset ? "mono" : "truecolor");
  const theme = useAsciiColors(rootRef, [preset?.paper ?? "--ascii-paper"]);
  const fieldRef = useRef<ToneField | null>(null);
  const pointer = useRef<[number, number]>([0, 0]);
  const resolved: Charset = resolveCharset(charset, chars);
  const packed = resolved.kind === "braille" || resolved.kind === "quadrants";

  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    time: seconds,
    delta,
    pointer: hover,
  }: AsciiGridDrawContext) => {
    const paper = toBytes(theme?.[0], [0, 0, 0]);
    const onLight =
      preset === undefined &&
      (0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2]) / 255 > 0.55;
    // Ease toward the pointer so the ridges glide rather than jump.
    const target: readonly [number, number] =
      interactive && hover.inside
        ? [hover.x / columns - 0.5, 0.5 - hover.y / rows]
        : [0, 0];
    const ease = delta > 0 ? 1 - Math.exp(-delta * 4) : 1;
    pointer.current[0] += (target[0] - pointer.current[0]) * ease;
    pointer.current[1] += (target[1] - pointer.current[1]) * ease;

    const [gx, gy] = resolved.grid;
    let field = fieldRef.current;
    if (!field || field.width !== columns * gx || field.height !== rows * gy) {
      field = createToneField(columns, rows, resolved, { color: true });
      fieldRef.current = field;
    }
    const aspect =
      (columns * metrics.width) / Math.max(1, rows * metrics.height);
    const params: DuskParams = {
      intensity: clamp(intensity, 0, 1),
      layers: Math.round(clamp(layers, 1, 6)),
      mist: clamp(mist, 0, 1),
      moon,
      night: smoothstep(0.05, 0.9, clamp(time, 0, 1)),
      onLight,
      pointer: pointer.current,
      stars: clamp(stars, 0, 1),
      time: seconds,
    };
    paintField(field, aspect, params, packed);
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
      interactive={interactive}
      handle={handle}
      fx={fx}
      {...props}
    />
  );
};
