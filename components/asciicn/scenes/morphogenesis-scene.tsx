"use client";

import { useRef } from "react";

import {
  ANSI16,
  AsciiGrid,
  createToneField,
  gradeRgb,
  hexToRgb,
  mapTones,
  nearestIndex,
  PHOSPHORS,
  RAMPS,
  resolveCharset,
  sampleRamp,
  useAsciiColors,
} from "@/lib/ascii";
import type {
  AsciiGridDrawContext,
  AsciiSceneProps,
  MutableFrame,
  PostFx,
  Rgb8,
  ToneField,
} from "@/lib/ascii";

/** Which growth the field shows. `drift` wanders between all four. */
export type MorphogenesisPattern =
  | "drift"
  | "coral"
  | "labyrinth"
  | "fingerprint"
  | "spots";

export interface MorphogenesisSceneProps extends AsciiSceneProps {
  /** The growth regime. `drift` lets slow regions morph between the others. Default `"drift"`. */
  pattern?: MorphogenesisPattern;
  /** How fast the reaction runs, 0 to 3. Default 1. */
  growth?: number;
  /** How fast the regions wander in `drift`, 0 to 3. Default 1. */
  drift?: number;
  /** Size of the stripes and spots, 0.5 to 2. Default 1. */
  scale?: number;
}

// Deep water to the glowing rim of fresh growth.
const BODY = [
  "#0b3540",
  "#0f5e66",
  "#13918c",
  "#37cfb0",
  "#9cf7dc",
  "#effff9",
].map(hexToRgb);

// Spot and coral regions drift toward cold indigo, so regimes read apart.
const ABYSS = [
  "#151a44",
  "#252f7c",
  "#3c55c4",
  "#6c8ff2",
  "#b8c9ff",
  "#f2f5ff",
].map(hexToRgb);

const REEF = {
  backdrop: "#021216",
  /** Fresh growth flushes warm before it settles into the teal body. */
  fresh: hexToRgb("#ff9a7c"),
} as const;

const DEFAULT_FX: PostFx = { bloom: 0.35 };

/** A numeric read that treats a missing index as 0. */
const read = (data: ArrayLike<number>, index: number): number =>
  data[index] ?? 0;

// --- Colour: one lookup table per look ---------------------------------------

const mix = (from: Rgb8, to: Rgb8, t: number): Rgb8 => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
];

const brightness = (rgb: Rgb8) => Math.max(rgb[0], rgb[1], rgb[2]) / 255;

type Look = Pick<
  AsciiSceneProps,
  "colorMode" | "phosphor" | "ramp" | "ansi" | "grade" | "background"
>;

const DEFAULT_RAMP = "glacier";

const toBytes = (rgba: readonly number[] | undefined, fallback: Rgb8): Rgb8 =>
  rgba
    ? [read(rgba, 0) * 255, read(rgba, 1) * 255, read(rgba, 2) * 255]
    : fallback;

/** A scene colour in the active colour mode. */
const createTint = (
  look: Look,
  tokens: readonly (readonly number[])[] | null
): ((rgb: Rgb8) => Rgb8) => {
  const { colorMode = "truecolor", grade } = look;
  if (colorMode === "duotone") {
    const ramp = look.ramp ?? DEFAULT_RAMP;
    const stops = (typeof ramp === "string" ? RAMPS[ramp] : ramp).map(hexToRgb);
    return (rgb) => sampleRamp(stops, 0.2 + 0.8 * brightness(rgb));
  }
  if (colorMode === "ansi16") {
    const table = ANSI16[look.ansi ?? "vga"];
    return (rgb) => {
      const graded = gradeRgb(rgb, grade);
      return table[nearestIndex(graded, table)] ?? graded;
    };
  }
  if (colorMode === "mono" || colorMode === "palette") {
    const glass =
      colorMode === "mono" && look.phosphor ? PHOSPHORS[look.phosphor] : null;
    const ink = glass
      ? hexToRgb(glass.ink)
      : toBytes(tokens?.[0], [220, 240, 236]);
    const paper = glass
      ? hexToRgb(glass.paper)
      : toBytes(tokens?.[1], hexToRgb(REEF.backdrop));
    return (rgb) => mix(paper, ink, 0.18 + 0.82 * brightness(rgb));
  }
  return (rgb) => gradeRgb(rgb, grade);
};

/** Ink and paper for a look: phosphor, ramp, theme tokens or the reef. */
const surfaceColors = (look: Look): { ink: string; paper: string } => {
  const { colorMode = "truecolor", phosphor, background = "paper" } = look;
  const ink =
    colorMode === "mono" && phosphor ? PHOSPHORS[phosphor].ink : "--ascii-ink";
  let paper: string = REEF.backdrop;
  if (colorMode === "mono") {
    paper = phosphor ? PHOSPHORS[phosphor].paper : "--ascii-paper";
  } else if (colorMode === "palette") {
    paper = "--ascii-paper";
  } else if (colorMode === "duotone") {
    const ramp = look.ramp ?? DEFAULT_RAMP;
    paper = (typeof ramp === "string" ? RAMPS[ramp][0] : ramp[0]) ?? paper;
  }
  return { ink, paper: background === "transparent" ? "transparent" : paper };
};

// Glyph colour by region, body brightness and freshness.
const REGION_STEPS = 8;
const SHADES = 48;
const FRESH_STEPS = 12;

/**
 * Every colour the scene can draw, already in the active colour mode, so a
 * frame only looks colours up.
 */
const buildShades = (tint: (rgb: Rgb8) => Rgb8): Uint8ClampedArray => {
  const table = new Uint8ClampedArray(REGION_STEPS * SHADES * FRESH_STEPS * 3);
  for (let region = 0; region < REGION_STEPS; region += 1) {
    const cold = (region / (REGION_STEPS - 1)) * 0.85;
    for (let shade = 0; shade < SHADES; shade += 1) {
      const level = shade / (SHADES - 1);
      const body = mix(sampleRamp(BODY, level), sampleRamp(ABYSS, level), cold);
      for (let fresh = 0; fresh < FRESH_STEPS; fresh += 1) {
        const rgb = tint(
          mix(body, REEF.fresh, (fresh / (FRESH_STEPS - 1)) * 0.8)
        );
        table.set(rgb, ((region * SHADES + shade) * FRESH_STEPS + fresh) * 3);
      }
    }
  }
  return table;
};

// --- The reaction --------------------------------------------------------------

/**
 * Gray-Scott reaction-diffusion: chemical A feeds in everywhere, B eats it
 * (A + 2B -> 3B) and decays. Feed and kill rates pick the shape B settles
 * into. Each regime is a point in that plane.
 */
const REGIMES = {
  coral: [0.0545, 0.062],
  fingerprint: [0.037, 0.06],
  labyrinth: [0.029, 0.057],
  spots: [0.0367, 0.0649],
} as const satisfies Record<
  Exclude<MorphogenesisPattern, "drift">,
  readonly [number, number]
>;

// The path `drift` walks. Neighbours sit close enough in the plane that the
// growth reshapes on the way instead of dying out.
const DRIFT_PATH = [
  REGIMES.labyrinth,
  REGIMES.fingerprint,
  REGIMES.coral,
  REGIMES.spots,
] as const;

/** Each regime's place on the drift path, for its colours. */
const PATH_SPOT = {
  coral: 2 / 3,
  fingerprint: 1 / 3,
  labyrinth: 0,
  spots: 1,
} as const satisfies Record<keyof typeof REGIMES, number>;

const PATH_STEPS = 128;
const DRIFT_TABLE = (() => {
  const table = new Float32Array(PATH_STEPS * 2);
  const last = DRIFT_PATH.length - 1;
  for (let i = 0; i < PATH_STEPS; i += 1) {
    const at = (i / (PATH_STEPS - 1)) * last;
    const from = Math.min(last - 1, Math.floor(at));
    const t = at - from;
    const a = DRIFT_PATH[from] ?? REGIMES.coral;
    const b = DRIFT_PATH[from + 1] ?? REGIMES.coral;
    table[i * 2] = a[0] + (b[0] - a[0]) * t;
    table[i * 2 + 1] = a[1] + (b[1] - a[1]) * t;
  }
  return table;
})();

interface Reef {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  a: Float32Array;
  b: Float32Array;
  nextA: Float32Array;
  nextB: Float32Array;
  /** B at the start of the frame, to tell fresh growth from old. */
  readonly before: Float32Array;
  /** Recent growth, 0 to 1, fading. Tints the newest edges. */
  readonly glow: Float32Array;
  readonly feed: Float32Array;
  readonly kill: Float32Array;
  /** Where each cell sits on the drift path, 0 to 1. Picks its colours. */
  readonly region: Float32Array;
  /** The drift waves per column and per row. */
  readonly waveX: Float32Array;
  readonly waveY: Float32Array;
  /** Iterations owed to the clock, carried between frames. */
  debt: number;
  /** Seconds until the next spontaneous seed. */
  sprout: number;
  random: number;
  /** The pattern it last grew under. */
  pattern: MorphogenesisPattern;
  lastX: number;
  lastY: number;
  /** Stroke length since the last spore, so drags seed evenly. */
  carry: number;
  wasDown: boolean;
}

const MAX_CELLS = 40_000;
const DIFFUSE_A = 1;
const DIFFUSE_B = 0.5;
/** Iterations per second at `growth` 1. */
const RATE = 240;
const MAX_ITERATIONS = 22;
const WARM_ITERATIONS = 520;

const createReef = (
  boxWidth: number,
  boxHeight: number,
  scale: number,
  key: string,
  pattern: MorphogenesisPattern
): Reef => {
  // Square cells about 2.6 CSS px across, so features keep their size.
  let pitch = 2.6 * scale;
  if ((boxWidth / pitch) * (boxHeight / pitch) > MAX_CELLS) {
    pitch = Math.sqrt((boxWidth * boxHeight) / MAX_CELLS);
  }
  const width = Math.max(24, Math.round(boxWidth / pitch));
  const height = Math.max(16, Math.round(boxHeight / pitch));
  const size = width * height;
  const make = () => new Float32Array(size);
  return {
    a: make().fill(1),
    b: make(),
    before: make(),
    carry: 0,
    debt: 0,
    feed: make(),
    glow: make(),
    height,
    key,
    kill: make(),
    lastX: -1,
    lastY: -1,
    nextA: make(),
    nextB: make(),
    pattern,
    random: 20_261_027,
    region: make(),
    sprout: 1,
    wasDown: false,
    waveX: new Float32Array(width * 3),
    waveY: new Float32Array(height * 3),
    width,
  };
};

/** A small seeded generator (Park-Miller), so still frames match on every load. */
const nextRandom = (reef: Reef): number => {
  reef.random = (reef.random * 16_807) % 2_147_483_647;
  return (reef.random - 1) / 2_147_483_646;
};

/** The most B within `reach` cells of a point, sampled on a ring. */
const nearbyB = (reef: Reef, cx: number, cy: number, reach: number) => {
  const { width, height, b } = reef;
  let most = 0;
  for (let i = 0; i <= 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const distance = i === 12 ? 0 : reach;
    const x = Math.round(cx + Math.cos(angle) * distance);
    const y = Math.round(cy + Math.sin(angle) * distance);
    const index =
      (((y % height) + height) % height) * width +
      (((x % width) + width) % width);
    most = Math.max(most, read(b, index));
  }
  return most;
};

/**
 * Drop a spore of B on open ground. Spores stay small and skip grown reef:
 * extra B there eats the A around it, the cells starve and a hole opens.
 */
const seed = (reef: Reef, cx: number, cy: number, radius: number) => {
  if (nearbyB(reef, cx, cy, radius + 3) >= 0.12) {
    return;
  }
  const { width, height, a, b } = reef;
  const r = Math.ceil(radius);
  for (let oy = -r; oy <= r; oy += 1) {
    for (let ox = -r; ox <= r; ox += 1) {
      const d = Math.hypot(ox, oy);
      if (d <= radius) {
        const x = (((Math.round(cx) + ox) % width) + width) % width;
        const y = (((Math.round(cy) + oy) % height) + height) % height;
        const index = y * width + x;
        b[index] = 0.5 + 0.2 * (1 - d / radius);
        a[index] = Math.min(read(a, index), 0.4);
      }
    }
  }
};

/** Light a soft disc as fresh growth, so every touch shows on the reef. */
const flush = (reef: Reef, cx: number, cy: number, radius: number) => {
  const { width, height, glow } = reef;
  const r = Math.ceil(radius);
  for (let oy = -r; oy <= r; oy += 1) {
    for (let ox = -r; ox <= r; ox += 1) {
      const d = Math.hypot(ox, oy) / radius;
      if (d < 1) {
        const x = (((Math.round(cx) + ox) % width) + width) % width;
        const y = (((Math.round(cy) + oy) % height) + height) % height;
        const index = y * width + x;
        glow[index] = Math.max(read(glow, index), 1 - d * d);
      }
    }
  }
};

/** Feed and kill per cell: one regime, or slow drifting regions of all four. */
const setRates = (reef: Reef, pattern: MorphogenesisPattern, time: number) => {
  const { width, height, feed, kill, region, waveX, waveY } = reef;
  if (pattern !== "drift") {
    const [f, k] = REGIMES[pattern];
    feed.fill(f);
    kill.fill(k);
    region.fill(PATH_SPOT[pattern]);
    return;
  }
  // Two crossed travelling waves about one box height long. Each fits a
  // whole number of times across the grid, so the wrap shows no seam.
  // Separable, so the trig runs per row and column, not per cell.
  const turn = Math.PI * 2;
  const k1x = (turn * Math.max(1, Math.round(width / (height * 1.3)))) / width;
  const k2x = (turn * Math.max(1, Math.round(width / (height * 0.8)))) / width;
  const k1y = turn / height;
  const k2y = (turn * 2) / height;
  for (let x = 0; x < width; x += 1) {
    waveX[x * 3] = Math.sin(k1x * x + time * 0.11);
    waveX[x * 3 + 1] = Math.sin(k2x * x - time * 0.08 + 1.3);
    waveX[x * 3 + 2] = Math.cos(k2x * x - time * 0.08 + 1.3);
  }
  for (let y = 0; y < height; y += 1) {
    waveY[y * 3] = Math.cos(k1y * y - time * 0.07);
    waveY[y * 3 + 1] = Math.cos(k2y * y + time * 0.095);
    waveY[y * 3 + 2] = Math.sin(k2y * y + time * 0.095);
  }
  for (let y = 0; y < height; y += 1) {
    const a = read(waveY, y * 3);
    const cosB = read(waveY, y * 3 + 1);
    const sinB = read(waveY, y * 3 + 2);
    for (let x = 0; x < width; x += 1) {
      // sin(p + q) = sin p cos q + cos p sin q.
      const s =
        0.5 +
        0.36 * read(waveX, x * 3) * a +
        0.2 * (read(waveX, x * 3 + 1) * cosB + read(waveX, x * 3 + 2) * sinB);
      // Stretched and eased, so each regime holds a broad patch and the
      // borders between them stay narrow.
      const t = Math.min(1, Math.max(0, 0.5 + (s - 0.5) * 1.7));
      const place = t * t * (3 - 2 * t);
      const step = Math.round(place * (PATH_STEPS - 1)) * 2;
      const index = y * width + x;
      region[index] = place;
      feed[index] = read(DRIFT_TABLE, step);
      kill[index] = read(DRIFT_TABLE, step + 1);
    }
  }
};

/**
 * One explicit step on a wrapping grid, with the nine-point Laplacian
 * (sides 0.2, corners 0.05) so spots grow round instead of square. The
 * stencil slides along each row: per column it keeps the centre value and
 * the sum above and below, so each cell reads three new values per
 * chemical instead of nine.
 */
const iterate = (reef: Reef) => {
  const { width, height, a, b, nextA, nextB, feed, kill } = reef;
  const last = width - 1;
  for (let y = 0; y < height; y += 1) {
    const up = (y === 0 ? height - 1 : y - 1) * width;
    const row = y * width;
    const down = (y === height - 1 ? 0 : y + 1) * width;
    // Column x - 1 (wrapped), then column x.
    let leftA = read(a, row + last);
    let leftVA = read(a, up + last) + read(a, down + last);
    let leftB = read(b, row + last);
    let leftVB = read(b, up + last) + read(b, down + last);
    let av = read(a, row);
    let midVA = read(a, up) + read(a, down);
    let bv = read(b, row);
    let midVB = read(b, up) + read(b, down);
    for (let x = 0; x < width; x += 1) {
      const right = x === last ? 0 : x + 1;
      const rightA = read(a, row + right);
      const rightVA = read(a, up + right) + read(a, down + right);
      const rightB = read(b, row + right);
      const rightVB = read(b, up + right) + read(b, down + right);
      const lapA =
        0.2 * (leftA + rightA + midVA) + 0.05 * (leftVA + rightVA) - av;
      const lapB =
        0.2 * (leftB + rightB + midVB) + 0.05 * (leftVB + rightVB) - bv;
      const index = row + x;
      const react = av * bv * bv;
      const f = read(feed, index);
      nextA[index] = av + DIFFUSE_A * lapA - react + f * (1 - av);
      nextB[index] =
        bv + DIFFUSE_B * lapB + react - (read(kill, index) + f) * bv;
      leftA = av;
      leftVA = midVA;
      leftB = bv;
      leftVB = midVB;
      av = rightA;
      midVA = rightVA;
      bv = rightB;
      midVB = rightVB;
    }
  }
  reef.a = nextA;
  reef.b = nextB;
  reef.nextA = a;
  reef.nextB = b;
};

/** Scatter starting colonies, then grow them into a developed reef. */
const warmReef = (reef: Reef, pattern: MorphogenesisPattern, time: number) => {
  const colonies = Math.round((reef.width * reef.height) / 260);
  for (let i = 0; i < colonies; i += 1) {
    seed(
      reef,
      nextRandom(reef) * reef.width,
      nextRandom(reef) * reef.height,
      2 + nextRandom(reef) * 2.5
    );
  }
  setRates(reef, pattern, time);
  for (let i = 0; i < WARM_ITERATIONS; i += 1) {
    iterate(reef);
  }
};

/** Re-seed an empty patch now and then, so a region that dies grows back. */
const sprout = (reef: Reef, dt: number) => {
  reef.sprout -= dt;
  if (reef.sprout > 0) {
    return;
  }
  reef.sprout = 0.6 + nextRandom(reef) * 1.2;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const x = Math.floor(nextRandom(reef) * reef.width);
    const y = Math.floor(nextRandom(reef) * reef.height);
    if (read(reef.b, y * reef.width + x) < 0.02) {
      seed(reef, x, y, 2.5);
      return;
    }
  }
};

interface Touch {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}

const SPORE = 2.2;
/** Spores per ring of a bloom, inside out. */
const BLOOM_RINGS = [6, 11, 16] as const;

/** Drag paints a trail of spores; a fresh press drops rings of them. */
const touch = (reef: Reef, { x, y, down }: Touch) => {
  if (down && reef.wasDown) {
    const gap = SPORE * 3.2;
    const length = Math.hypot(x - reef.lastX, y - reef.lastY);
    // Spores fall at even spacing along the stroke, carried across frames.
    let along = gap - reef.carry;
    while (along <= length) {
      const t = along / length;
      seed(
        reef,
        reef.lastX + (x - reef.lastX) * t,
        reef.lastY + (y - reef.lastY) * t,
        SPORE
      );
      along += gap;
    }
    reef.carry = length - (along - gap);
    flush(reef, x, y, SPORE * 4);
  } else if (down) {
    seed(reef, x, y, SPORE * 1.4);
    flush(reef, x, y, BLOOM_RINGS.length * SPORE * 5);
    const turn = nextRandom(reef) * Math.PI;
    for (const [ring, count] of BLOOM_RINGS.entries()) {
      const distance = (ring + 1) * SPORE * 4.4;
      for (let i = 0; i < count; i += 1) {
        const angle = turn + ((i + ring * 0.5) / count) * Math.PI * 2;
        seed(
          reef,
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance,
          SPORE
        );
      }
    }
    reef.carry = 0;
  }
  reef.lastX = x;
  reef.lastY = y;
  reef.wasDown = down;
};

/** Advance the reef by `dt` seconds of clock, from `before` (set by the caller). */
const grow = (
  reef: Reef,
  dt: number,
  growth: number,
  pattern: MorphogenesisPattern,
  driftTime: number
) => {
  reef.pattern = pattern;
  setRates(reef, pattern, driftTime);
  sprout(reef, dt);
  reef.debt += dt * RATE * growth;
  const count = Math.min(MAX_ITERATIONS, Math.floor(reef.debt));
  reef.debt = Math.min(reef.debt - count, 1);
  for (let i = 0; i < count; i += 1) {
    iterate(reef);
  }
  // Growth this frame lights the cell; old growth fades back to the body.
  const { b, before, glow } = reef;
  const keep = Math.exp(-dt * 0.7);
  for (let index = 0; index < glow.length; index += 1) {
    const rise = Math.max(0, read(b, index) - read(before, index));
    glow[index] = Math.min(1, read(glow, index) * keep + rise * 5);
  }
};

// --- Drawing --------------------------------------------------------------------

interface Canvas {
  readonly key: string;
  readonly field: ToneField;
  /** Cell colours, RGBA, lent to the frame after the glyphs are mapped. */
  readonly colors: Uint8ClampedArray;
  /** Per sample column: the reef cell to its left and the blend. */
  readonly columnIndex: Int32Array;
  readonly columnWeight: Float32Array;
}

const createCanvas = (
  columns: number,
  rows: number,
  gx: number,
  gy: number,
  key: string
): Canvas => {
  const field = createToneField(columns, rows, {
    glyphs: [" ", "#"],
    grid: [gx, gy],
    id: "reef",
    kind: "ramp",
    label: "reef",
  });
  return {
    colors: new Uint8ClampedArray(columns * rows * 4),
    columnIndex: new Int32Array(field.width),
    columnWeight: new Float32Array(field.width),
    field,
    key,
  };
};

/** B concentration to tone: empty below 0.06, full near 0.34. */
const toTone = (b: number) => {
  const t = Math.min(1, Math.max(0, (b - 0.06) / 0.28));
  return t * t * (3 - 2 * t);
};

/** Bilinear upsample of B to the charset's sample grid. */
const render = (canvas: Canvas, reef: Reef) => {
  const { field, columnIndex, columnWeight } = canvas;
  const { width, height, b } = reef;
  const scaleX = width / field.width;
  const scaleY = height / field.height;
  for (let x = 0; x < field.width; x += 1) {
    const fx = Math.min(width - 1.001, Math.max(0, (x + 0.5) * scaleX - 0.5));
    columnIndex[x] = Math.floor(fx);
    columnWeight[x] = fx - Math.floor(fx);
  }
  for (let y = 0; y < field.height; y += 1) {
    const fy = Math.min(height - 1.001, Math.max(0, (y + 0.5) * scaleY - 0.5));
    const top = Math.floor(fy) * width;
    const wy = fy - Math.floor(fy);
    for (let x = 0; x < field.width; x += 1) {
      const at = top + read(columnIndex, x);
      const wx = read(columnWeight, x);
      const value =
        (read(b, at) * (1 - wx) + read(b, at + 1) * wx) * (1 - wy) +
        (read(b, at + width) * (1 - wx) + read(b, at + width + 1) * wx) * wy;
      field.tones[y * field.width + x] = toTone(value);
    }
  }
};

/**
 * Colour each inked cell from the reef under it: dense interiors sit deep,
 * steep edges glow, and fresh growth flushes warm.
 */
const colorCells = (
  frame: MutableFrame,
  reef: Reef,
  shades: Uint8ClampedArray
) => {
  const { colors, glyphs, columns, rows } = frame;
  if (!colors) {
    return;
  }
  const { width, height, b, glow, region } = reef;
  for (let row = 0; row < rows; row += 1) {
    const y = Math.min(
      height - 2,
      Math.max(1, Math.floor(((row + 0.5) / rows) * height))
    );
    for (let column = 0; column < columns; column += 1) {
      const cell = row * columns + column;
      if (glyphs[cell] === " ") {
        colors[cell * 4 + 3] = 0;
        continue;
      }
      const x = Math.min(
        width - 2,
        Math.max(1, Math.floor(((column + 0.5) / columns) * width))
      );
      const index = y * width + x;
      const value = read(b, index);
      const slope = Math.hypot(
        read(b, index + 1) - read(b, index - 1),
        read(b, index + width) - read(b, index - width)
      );
      const level = Math.min(1, 0.08 + toTone(value) * 0.27 + slope * 4);
      const shade = Math.round(level * (SHADES - 1));
      const fresh = Math.round(read(glow, index) * (FRESH_STEPS - 1));
      const zone = Math.round(read(region, index) * (REGION_STEPS - 1));
      const at = ((zone * SHADES + shade) * FRESH_STEPS + fresh) * 3;
      colors[cell * 4] = read(shades, at);
      colors[cell * 4 + 1] = read(shades, at + 1);
      colors[cell * 4 + 2] = read(shades, at + 2);
      colors[cell * 4 + 3] = 255;
    }
  }
};

const clampKnob = (value: number) => Math.min(3, Math.max(0, value));

/**
 * Glyph Morphogenesis. A Gray-Scott reaction-diffusion field grows coral,
 * fingerprint whorls, labyrinths and dividing spots, and slow drifting
 * regions morph one into the next. Concentration sets the glyph; steep
 * edges glow and fresh growth flushes warm. Drag to paint new growth,
 * press to drop a bloom.
 */
export const MorphogenesisScene = ({
  charset = "braille",
  chars,
  colorMode = "truecolor",
  phosphor,
  ramp,
  ansi,
  grade,
  invert,
  threshold,
  edgeThreshold,
  dither,
  background = "paper",
  fx = DEFAULT_FX,
  cell = 12,
  speed = 1,
  animate = true,
  fps = 30,
  stillTime = 0,
  interactive = true,
  handle,
  pattern = "drift",
  growth = 1,
  drift = 1,
  scale = 1,
  className,
  ...props
}: MorphogenesisSceneProps) => {
  const reefRef = useRef<Reef | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const tokens = useAsciiColors();

  const look: Look = { ansi, background, colorMode, grade, phosphor, ramp };
  const surface = surfaceColors(look);
  const shades = buildShades(createTint(look, tokens));
  const featureScale = Math.min(2, Math.max(0.5, scale));
  const rate = clampKnob(growth);
  const wander = clampKnob(drift);

  const draw = (context: AsciiGridDrawContext) => {
    const { frame, columns, rows, delta, time, metrics, pointer } = context;
    const driftTime = time * wander;
    const set = resolveCharset(charset, chars);
    const [gx, gy] = set.grid;
    const canvasKey = `${columns}x${rows}x${gx}x${gy}`;
    if (canvasRef.current?.key !== canvasKey) {
      canvasRef.current = createCanvas(columns, rows, gx, gy, canvasKey);
    }
    const canvas = canvasRef.current;

    // One sample per glyph needs bigger features than Braille's eight to
    // read as shapes rather than noise.
    const grain = gx * gy > 1 ? 1 : 2.2;
    const reefKey = `${columns}x${rows}x${featureScale * grain}`;
    let reef = reefRef.current;
    // A still frame can't morph, so a new pattern regrows it from scratch.
    if (reef?.key !== reefKey || (delta === 0 && reef.pattern !== pattern)) {
      reef = createReef(
        columns * metrics.width,
        rows * metrics.height,
        featureScale * grain,
        reefKey,
        pattern
      );
      warmReef(reef, pattern, driftTime);
      reefRef.current = reef;
    }

    if (delta > 0) {
      // Before the pointer seeds, so painted spores count as fresh growth.
      reef.before.set(reef.b);
      if (interactive && pointer.inside) {
        touch(reef, {
          down: pointer.down,
          x: (pointer.x / columns) * reef.width,
          y: (pointer.y / rows) * reef.height,
        });
      } else {
        reef.wasDown = false;
      }
      grow(reef, Math.min(delta, 0.1), rate, pattern, driftTime);
    }

    render(canvas, reef);
    mapTones(
      canvas.field,
      columns,
      rows,
      {
        charset: set,
        // Glyphs only: the scene colours cells itself, from the reef.
        colorMode: "mono",
        dither: dither ?? "none",
        edgeThreshold,
        grade,
        invert,
        threshold,
      },
      frame
    );
    frame.colors = canvas.colors;
    colorCells(frame, reef, shades);
  };

  return (
    <AsciiGrid
      draw={draw}
      cell={cell}
      ink={surface.ink}
      paper={surface.paper}
      colored
      speed={speed}
      animate={animate}
      fps={fps}
      stillTime={stillTime}
      interactive={interactive}
      handle={handle}
      fx={fx}
      className={className}
      {...props}
    />
  );
};
