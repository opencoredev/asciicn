"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  AsciiGrid,
  createToneField,
  hexToRgb,
  mapTones,
  PHOSPHORS,
  RAMPS,
  resolveCharset,
  sampleRamp,
  useAsciiColors,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiSceneProps,
  Charset,
  MutableFrame,
  RampName,
  Rgb8,
  Rgba,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/** `truecolor` cools from `hot` to `cool`; `duotone` uses `ramp`; `mono` draws in the ink. */
export type GlyphTrailColorMode = "truecolor" | "duotone" | "mono";

export interface GlyphTrailProps extends Omit<
  AsciiSceneProps,
  "colorMode" | "interactive" | "invert" | "ansi"
> {
  /** How long a glyph takes to cool and vanish, in seconds. Default 2.4. */
  decay?: number;
  /** How wide the trail fans out around the path, in cells. Default 1.8. */
  spread?: number;
  /** A slow wanderer draws the trail while nobody moves the pointer. Default `true`. */
  idle?: boolean;
  /** Which glyphs draw the trail, densest at the head. Default `"standard"`. */
  charset?: AsciiSceneProps["charset"];
  /** Default `"truecolor"`, or `"mono"` with a phosphor. */
  colorMode?: GlyphTrailColorMode;
  /** The colour of a fresh glyph in truecolor. Default `"orange"`. */
  hot?: AsciiColor;
  /** The colour a glyph cools to in truecolor. Default `"ink"`. */
  cool?: AsciiColor;
  /** `duotone`: a ramp name or stops as `#rrggbb`, cold to hot. Default `"ember"`. */
  ramp?: RampName | readonly string[];
  /** `"paper"` fills the box behind the glyphs. Default `"transparent"`, or `"paper"` with a phosphor. */
  background?: "paper" | "transparent";
  /** Cell height in CSS pixels. Default 14. */
  cell?: number;
  /** Frame rate cap while the pointer draws; the idle wanderer runs at up to 30. Default 60. */
  fps?: number;
  /** Where the wanderer's path ends in the still frame drawn under reduced motion, in seconds. Default 7. */
  stillTime?: number;
  /** Clear the trail behind the children's text and controls so they stay readable. Default `true`. */
  clearContent?: boolean;
  /** Content drawn above the trail. Clicks reach it as usual. Default: none. */
  children?: ReactNode;
}

/* -------------------------------------------------------------------------- */
/* Maths                                                                       */
/* -------------------------------------------------------------------------- */

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// A float hash in [0, 1), stable for integer inputs, no bitwise maths.
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

const mixRgb = (a: Rgb8, b: Rgb8, t: number): Rgb8 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

const toBytes = (rgba: Rgba | undefined, fallback: Rgb8): Rgb8 =>
  rgba ? [rgba[0] * 255, rgba[1] * 255, rgba[2] * 255] : fallback;

/* -------------------------------------------------------------------------- */
/* Simulation                                                                  */
/* -------------------------------------------------------------------------- */

// Lengths are in cell heights and times in seconds, so the trail keeps its
// shape at any cell size.
const TUNING = {
  /** Most puffs alive at once. */
  capacity: 2400,
  /** Share of velocity lost per second. */
  drag: 1.8,
  /** Seconds the wanderer takes to fade in or out. */
  fade: 0.9,
  /** Seconds between two moves that still join into one stroke. */
  gap: 0.12,
  /** Upward drift, like warm air. */
  lift: 1.5,
  /** Seconds of stillness before the wanderer comes back. */
  quiet: 2.5,
  /** Distance between puffs laid along a stroke. */
  spacing: 0.3,
  /** Sideways wander from a slow flow field. */
  swirl: 4,
  /** Decay lengths simulated before the first frame, so it starts full. */
  warm: 1.3,
} as const satisfies Record<string, number>;

// A fixed seed: the first frame and the reduced-motion frame are the same
// picture on every load.
const SEED = 20_261_109;

/** One puff of glyph smoke, or a spark when `spark` is set. */
interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  heat: number;
  size: number;
  spark: boolean;
}

interface Trail {
  readonly pool: Puff[];
  count: number;
  seed: number;
  /** Seconds of simulation so far. */
  clock: number;
  /** The grid's `time` at the previous draw. */
  lastTime: number;
  /** Seconds since the pointer last drew. */
  quiet: number;
  /** How much the wanderer lays down, 0 to 1. */
  wander: number;
  wanderX: number;
  wanderY: number;
  hasWander: boolean;
  wanderCarry: number;
  strokeX: number;
  strokeY: number;
  strokeTime: number;
  hasStroke: boolean;
  strokeCarry: number;
  warmed: boolean;
}

const createPuff = (): Puff => ({
  age: 0,
  heat: 0,
  life: 1,
  size: 0,
  spark: false,
  vx: 0,
  vy: 0,
  x: 0,
  y: 0,
});

const createTrail = (): Trail => ({
  clock: 0,
  count: 0,
  hasStroke: false,
  hasWander: false,
  lastTime: 0,
  pool: Array.from({ length: TUNING.capacity }, createPuff),
  quiet: TUNING.quiet,
  seed: SEED,
  strokeCarry: 0,
  strokeTime: 0,
  strokeX: 0,
  strokeY: 0,
  wander: 1,
  wanderCarry: 0,
  wanderX: 0,
  wanderY: 0,
  warmed: false,
});

const resetTrail = (trail: Trail, clock: number) => {
  trail.count = 0;
  trail.seed = SEED;
  trail.clock = clock;
  trail.quiet = TUNING.quiet;
  trail.wander = 1;
  trail.hasWander = false;
  trail.hasStroke = false;
  trail.wanderCarry = 0;
  trail.strokeCarry = 0;
  trail.warmed = true;
};

/** A seeded number in [0, 1): Park and Miller, exact in doubles. */
const random = (trail: Trail): number => {
  trail.seed = (trail.seed * 48_271) % 2_147_483_647;
  return trail.seed / 2_147_483_647;
};

interface EmitOptions {
  /** Cell height in CSS pixels. */
  readonly cell: number;
  readonly spread: number;
  readonly decay: number;
  /** Scales heat, for the wanderer fading in and out. */
  readonly amount: number;
  /** The least energy a stroke counts as, so the slow wanderer still shows. */
  readonly floor: number;
}

const spawn = (trail: Trail, values: Omit<Puff, "spark">, spark: boolean) => {
  const puff = trail.pool[trail.count];
  if (!puff) {
    return;
  }
  trail.count += 1;
  puff.x = values.x;
  puff.y = values.y;
  puff.vx = values.vx;
  puff.vy = values.vy;
  puff.age = values.age;
  puff.life = values.life;
  puff.heat = values.heat;
  puff.size = values.size;
  puff.spark = spark;
};

/**
 * Lay puffs along a stroke from (x0, y0) to (x1, y1), one every
 * `spacing` cells, carrying the leftover distance into the next stroke.
 * Faster strokes lay hotter, wider puffs that fan out further and throw
 * more sparks; each puff starts as old as the time since the pointer
 * passed its spot, so a fast stroke is already graded from head to tail.
 * Returns the distance left over.
 */
const emitStroke = (
  trail: Trail,
  from: readonly [number, number],
  to: readonly [number, number],
  seconds: number,
  carry: number,
  options: EmitOptions
): number => {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.25 || options.amount < 0.02) {
    return carry;
  }
  const span = clamp(seconds, 1 / 240, 0.25);
  const speed = distance / span;
  const energy = Math.max(options.floor, smoothstep(40, 1800, speed));
  const ux = dx / distance;
  const uy = dy / distance;
  const { cell, decay, amount } = options;
  const spacing = cell * TUNING.spacing;
  const fan = options.spread * cell;
  let left = carry + distance;
  let laid = 0;
  while (left >= spacing && laid < 600) {
    left -= spacing;
    laid += 1;
    const t = clamp(1 - left / distance, 0, 1);
    const side = (random(trail) - 0.5) * 2;
    const kick = (random(trail) - 0.5) * 2;
    const push = random(trail);
    const x = x0 + dx * t - uy * side * fan * 0.28;
    const y = y0 + dy * t + ux * side * fan * 0.28;
    const age = (1 - t) * span;
    if (random(trail) < 0.03 + 0.14 * energy) {
      // A spark: one bright glyph thrown off the stroke, rising as it cools.
      const throwSpeed = cell * lerp(2, 6, random(trail));
      spawn(
        trail,
        {
          age,
          heat: amount * lerp(0.85, 1, random(trail)),
          life: decay * lerp(0.8, 1.5, random(trail)),
          size: 0,
          vx: ux * speed * 0.1 * push - uy * kick * throwSpeed,
          vy: uy * speed * 0.1 * push + ux * kick * throwSpeed - cell * 1.5,
          x,
          y,
        },
        true
      );
      continue;
    }
    const open = fan * lerp(0.6, 2.2, energy);
    spawn(
      trail,
      {
        age,
        heat: amount * lerp(0.62, 1, energy) * lerp(0.85, 1, random(trail)),
        life: decay * lerp(0.7, 1.15, random(trail)) * lerp(0.85, 1.25, energy),
        size: fan * lerp(0.6, 1.05, energy) * lerp(0.75, 1.2, random(trail)),
        vx: ux * speed * 0.06 * push - uy * kick * open,
        vy: uy * speed * 0.06 * push + ux * kick * open,
        x,
        y,
      },
      false
    );
  }
  return left;
};

/**
 * The idle wanderer: a slow Lissajous loop with a little wobble on top,
 * spanning most of the box. About one sweep across every six seconds.
 */
const wanderAt = (
  clock: number,
  width: number,
  height: number
): readonly [number, number] => {
  const a = clock * 0.8;
  return [
    width * (0.5 + 0.38 * Math.sin(a + 0.4) + 0.04 * Math.sin(a * 2.3 + 1.1)),
    height * (0.5 + 0.33 * Math.sin(a * 1.37) + 0.05 * Math.cos(a * 2.9 + 0.3)),
  ];
};

/** Age, drift and retire every puff: lift, a slow swirl and drag. */
const stepPuffs = (
  trail: Trail,
  dt: number,
  cell: number,
  width: number,
  height: number
) => {
  const drag = Math.exp(-dt * TUNING.drag);
  const lift = TUNING.lift * cell * dt;
  const swirl = TUNING.swirl * cell * dt;
  const scale = 1 / (cell * 7);
  const flow = trail.clock * 0.12;
  const margin = cell * 4;
  const { pool } = trail;
  let index = 0;
  while (index < trail.count) {
    const puff = pool[index];
    if (!puff) {
      break;
    }
    puff.age += dt;
    const gone =
      puff.age >= puff.life ||
      puff.x < -margin ||
      puff.y < -margin ||
      puff.x > width + margin ||
      puff.y > height + margin;
    if (gone) {
      // Swap with the last live puff so the pool stays packed.
      const last = trail.count - 1;
      const tail = pool[last];
      if (tail) {
        pool[index] = tail;
        pool[last] = puff;
      }
      trail.count = last;
      continue;
    }
    const angle = noise(puff.x * scale, puff.y * scale - flow) * Math.PI * 4;
    const rise = puff.spark ? lift * 1.6 : lift;
    puff.vx = (puff.vx + Math.cos(angle) * swirl) * drag;
    puff.vy = (puff.vy + Math.sin(angle) * swirl - rise) * drag;
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    index += 1;
  }
};

interface Scene {
  readonly cell: number;
  readonly width: number;
  readonly height: number;
  readonly emit: Omit<EmitOptions, "amount" | "floor">;
  readonly idle: boolean;
}

/** One simulation step: the wanderer lays its stroke, then puffs drift. */
const advance = (trail: Trail, dt: number, scene: Scene) => {
  trail.clock += dt;
  trail.quiet += dt;
  const target = scene.idle && trail.quiet >= TUNING.quiet ? 1 : 0;
  const rate = dt / TUNING.fade;
  trail.wander =
    target > trail.wander
      ? Math.min(target, trail.wander + rate)
      : Math.max(target, trail.wander - rate);
  const next = wanderAt(trail.clock, scene.width, scene.height);
  if (trail.hasWander && trail.wander > 0.02) {
    trail.wanderCarry = emitStroke(
      trail,
      [trail.wanderX, trail.wanderY],
      next,
      dt,
      trail.wanderCarry,
      { ...scene.emit, amount: smoothstep(0, 1, trail.wander), floor: 0.4 }
    );
  }
  [trail.wanderX, trail.wanderY] = next;
  trail.hasWander = true;
  stepPuffs(trail, dt, scene.cell, scene.width, scene.height);
};

/** Start from a full trail: run the wanderer for a while before `until`. */
const warmUp = (trail: Trail, until: number, scene: Scene) => {
  resetTrail(trail, until - scene.emit.decay * TUNING.warm);
  if (!scene.idle) {
    return;
  }
  const step = 1 / 30;
  while (trail.clock < until - 1e-6) {
    advance(trail, Math.min(step, until - trail.clock), scene);
  }
};

/* -------------------------------------------------------------------------- */
/* Pointer                                                                     */
/* -------------------------------------------------------------------------- */

// Moves wait here, in client pixels, until the next frame turns them into
// strokes. Four numbers each: x, y, timestamp, and 1 for a new touch.
const QUEUE_SIZE = 64;

interface PointerQueue {
  readonly data: Float64Array;
  count: number;
}

const createQueue = (): PointerQueue => ({
  count: 0,
  data: new Float64Array(QUEUE_SIZE * 4),
});

/** Turn queued moves inside the box into strokes. */
const drainQueue = (
  trail: Trail,
  queue: PointerQueue,
  rect: DOMRect,
  scene: Scene
) => {
  const { data } = queue;
  for (let index = 0; index < queue.count; index += 1) {
    const at = index * 4;
    const x = (data[at] ?? 0) - rect.left;
    const y = (data[at + 1] ?? 0) - rect.top;
    const time = data[at + 2] ?? 0;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    if (!inside || data[at + 3] === 1) {
      trail.hasStroke = false;
      if (!inside) {
        continue;
      }
    }
    // Browsers send moves when the page shifts under a resting pointer;
    // only real travel counts as drawing.
    const travel = trail.hasStroke
      ? Math.hypot(x - trail.strokeX, y - trail.strokeY)
      : 0;
    if (trail.hasStroke) {
      const seconds = (time - trail.strokeTime) / 1000;
      if (seconds < TUNING.gap || travel < scene.cell * 6) {
        trail.strokeCarry = emitStroke(
          trail,
          [trail.strokeX, trail.strokeY],
          [x, y],
          seconds,
          trail.strokeCarry,
          { ...scene.emit, amount: 1, floor: 0 }
        );
      }
    } else {
      trail.strokeCarry = 0;
    }
    trail.strokeX = x;
    trail.strokeY = y;
    trail.strokeTime = time;
    trail.hasStroke = true;
    if (travel > 1) {
      trail.quiet = 0;
    }
  }
  queue.count = 0;
};

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

interface Buffers {
  readonly field: ToneField;
  /** Summed heat per sample, before it saturates into a tone. */
  readonly heat: Float32Array;
  /** The hottest puff over each sample, for colour. */
  readonly temperature: Float32Array;
  /** The hottest sample in each cell. */
  readonly cells: Float32Array;
  /** Per cell, how much trail shows: 1 in the open, low behind content. */
  readonly clear: Float32Array;
  /** When `clear` was last measured, from `performance.now()`. */
  clearAt: number;
  readonly key: string;
}

const createBuffers = (
  columns: number,
  rows: number,
  charset: Charset,
  key: string
): Buffers => {
  const field = createToneField(columns, rows, charset);
  const samples = field.width * field.height;
  return {
    cells: new Float32Array(columns * rows),
    clear: new Float32Array(columns * rows).fill(1),
    clearAt: Number.NEGATIVE_INFINITY,
    field,
    heat: new Float32Array(samples),
    key,
    temperature: new Float32Array(samples),
  };
};

/**
 * Splat every puff into the sample grid. A puff is a soft disc that grows
 * as it cools, like smoke spreading; a spark lights only the sample it is
 * in, so it draws as one glyph or one Braille dot.
 */
const splatPuffs = (
  trail: Trail,
  buffers: Buffers,
  sampleWidth: number,
  sampleHeight: number
) => {
  const { heat, temperature, field } = buffers;
  const { width, height } = field;
  for (let index = 0; index < trail.count; index += 1) {
    const puff = trail.pool[index];
    if (!puff) {
      break;
    }
    const left = 1 - puff.age / puff.life;
    // Density lingers and colour cools fast: a short amber head, a long
    // body of ink smoke that thins out at the end.
    const age = 1 - left;
    const body = puff.heat * (puff.spark ? left ** 0.5 : 1 - age ** 1.6);
    const warmth = puff.heat * left ** (puff.spark ? 0.8 : 1.7);
    if (body < 0.012) {
      continue;
    }
    if (puff.spark) {
      const sx = Math.floor(puff.x / sampleWidth);
      const sy = Math.floor(puff.y / sampleHeight);
      if (sx >= 0 && sy >= 0 && sx < width && sy < height) {
        const at = sy * width + sx;
        heat[at] += body * 1.4;
        temperature[at] = Math.max(temperature[at], warmth);
      }
      continue;
    }
    const radius = puff.size * (0.6 + 1.6 * age);
    const inverse = 1 / (radius * radius);
    const strength = body * 0.6;
    const x0 = Math.max(0, Math.floor((puff.x - radius) / sampleWidth));
    const x1 = Math.min(width - 1, Math.ceil((puff.x + radius) / sampleWidth));
    const y0 = Math.max(0, Math.floor((puff.y - radius) / sampleHeight));
    const y1 = Math.min(
      height - 1,
      Math.ceil((puff.y + radius) / sampleHeight)
    );
    for (let sy = y0; sy <= y1; sy += 1) {
      const dy = (sy + 0.5) * sampleHeight - puff.y;
      const dy2 = dy * dy;
      const row = sy * width;
      for (let sx = x0; sx <= x1; sx += 1) {
        const dx = (sx + 0.5) * sampleWidth - puff.x;
        const q = (dx * dx + dy2) * inverse;
        if (q < 1) {
          const soft = 1 - q;
          const at = row + sx;
          heat[at] += strength * soft * soft;
          // Colour falls off slower than density, so the hot core is wide.
          temperature[at] = Math.max(temperature[at], warmth * soft);
        }
      }
    }
  }
};

/**
 * Heat to tones: summed heat saturates toward full ink, and the cooler
 * tail breaks into wisps through a slow noise, so it frays like smoke
 * while the head stays solid. Also records each cell's hottest sample.
 */
const shadeField = (
  buffers: Buffers,
  columns: number,
  grid: readonly [number, number],
  sample: readonly [number, number],
  cell: number,
  time: number
) => {
  const { heat, temperature, cells, clear, field } = buffers;
  const { width, height, tones } = field;
  const [gx, gy] = grid;
  const [sampleWidth, sampleHeight] = sample;
  const wisp = 1 / (cell * 1.3);
  const drift = time * 0.35;
  cells.fill(0);
  for (let sy = 0; sy < height; sy += 1) {
    const row = sy * width;
    const cellRow = Math.floor(sy / gy) * columns;
    const ny = (sy + 0.5) * sampleHeight * wisp - drift;
    for (let sx = 0; sx < width; sx += 1) {
      const at = row + sx;
      const amount = heat[at];
      if (amount <= 0) {
        tones[at] = 0;
        continue;
      }
      const warmth = temperature[at];
      const fray = lerp(0.3, 1.3, noise((sx + 0.5) * sampleWidth * wisp, ny));
      const solid = smoothstep(0.25, 0.75, warmth);
      const index = cellRow + Math.floor(sx / gx);
      tones[at] =
        (1 - Math.exp(-amount * 2.4)) * lerp(fray, 1, solid) * clear[index];
      cells[index] = Math.max(cells[index], warmth);
    }
  }
};

const LUT_SIZE = 64;

const CONTROLS = "a, button, input, select, textarea, [role='button']";

/**
 * Where the content sits, relative to the wrapper: every line of text
 * and every control. Lines rather than element boxes, so a full-size
 * wrapper around the content doesn't hide the whole trail.
 */
const contentRects = (root: HTMLElement): DOMRect[] => {
  const origin = root.getBoundingClientRect();
  const rects: DOMRect[] = [];
  const add = (rect: DOMRect) => {
    if (rect.width > 0 && rect.height > 0) {
      rects.push(
        new DOMRect(
          rect.left - origin.left,
          rect.top - origin.top,
          rect.width,
          rect.height
        )
      );
    }
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim()) {
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        add(rect);
      }
    }
  }
  for (const control of root.querySelectorAll(CONTROLS)) {
    add(control.getBoundingClientRect());
  }
  return rects;
};

/**
 * Clear the trail behind content so text keeps its contrast: cells over a
 * line of text or a control stay empty, and the trail eases back to full
 * over a cell and a half around them.
 */
const measureClearance = (
  clear: Float32Array,
  columns: number,
  rows: number,
  cellSize: readonly [number, number],
  rects: readonly DOMRect[]
) => {
  clear.fill(1);
  const [cellWidth, cellHeight] = cellSize;
  const reach = cellHeight * 1.5;
  for (const rect of rects) {
    const c0 = Math.max(0, Math.floor((rect.left - reach) / cellWidth));
    const c1 = Math.min(
      columns - 1,
      Math.ceil((rect.right + reach) / cellWidth)
    );
    const r0 = Math.max(0, Math.floor((rect.top - reach) / cellHeight));
    const r1 = Math.min(
      rows - 1,
      Math.ceil((rect.bottom + reach) / cellHeight)
    );
    for (let row = r0; row <= r1; row += 1) {
      const y = (row + 0.5) * cellHeight;
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      for (let column = c0; column <= c1; column += 1) {
        const x = (column + 0.5) * cellWidth;
        const dx = Math.max(rect.left - x, 0, x - rect.right);
        const keep = smoothstep(0, reach, Math.hypot(dx, dy));
        const index = row * columns + column;
        clear[index] = Math.min(clear[index], keep);
      }
    }
  }
};

/**
 * Colour by temperature: stops from cold to hot, with cold glyphs drawn
 * translucent so the tail fades into whatever is behind the box.
 */
const buildLut = (stops: readonly Rgb8[]): Uint8ClampedArray => {
  const lut = new Uint8ClampedArray(LUT_SIZE * 4);
  for (let index = 0; index < LUT_SIZE; index += 1) {
    const t = index / (LUT_SIZE - 1);
    const [r, g, b] = sampleRamp(stops, t);
    lut[index * 4] = r;
    lut[index * 4 + 1] = g;
    lut[index * 4 + 2] = b;
    lut[index * 4 + 3] = lerp(0.28, 1, smoothstep(0, 0.55, t)) * 255;
  }
  return lut;
};

/** Paint each drawn cell with its temperature's colour. */
const tintFrame = (
  frame: MutableFrame,
  cells: Float32Array,
  lut: Uint8ClampedArray
) => {
  const { glyphs, colors } = frame;
  if (!colors) {
    return;
  }
  for (let index = 0; index < glyphs.length; index += 1) {
    if (glyphs[index] === " ") {
      continue;
    }
    const level = Math.round(clamp(cells[index] * 1.15, 0, 1) * (LUT_SIZE - 1));
    colors.set(lut.subarray(level * 4, level * 4 + 4), index * 4);
  }
};

const rampBytes = (ramp: RampName | readonly string[]): Rgb8[] => {
  const hex: readonly string[] =
    typeof ramp === "string" ? (RAMPS[ramp] ?? RAMPS.ember) : ramp;
  return hex.map(hexToRgb);
};

type Pace = "live" | "calm" | "asleep";

/**
 * One running frame: turn queued moves into strokes, step the simulation
 * and pick the pace. Full rate while someone draws, a calm 30 for the
 * wanderer, and no loop at all once a trail without one has burned out.
 */
const simulate = (
  trail: Trail,
  time: number,
  queue: PointerQueue | null,
  root: HTMLElement | null,
  scene: Scene,
  stillTime: number
): Pace => {
  if (!trail.warmed) {
    warmUp(trail, stillTime, scene);
    trail.lastTime = time;
  }
  const dt = clamp(time - trail.lastTime, 0, 0.1);
  trail.lastTime = time;
  const rect = queue && queue.count > 0 ? root?.getBoundingClientRect() : null;
  if (queue && rect && rect.width > 0) {
    drainQueue(trail, queue, rect, scene);
  }
  if (dt > 0) {
    advance(trail, dt, scene);
  }
  if (trail.quiet < TUNING.quiet) {
    return "live";
  }
  return !scene.idle && trail.count === 0 ? "asleep" : "calm";
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Glyph trail. Moving the pointer (mouse, pen or touch) over the box lays
 * glyphs that start hot and dense, then cool through the charset toward
 * sparse glyphs and drift up and aside like smoke before they vanish. A
 * quick flick leaves a long comet with sparks. While nobody draws, a slow
 * wanderer keeps a trail going. The canvas never takes pointer events, so
 * content above or below it stays clickable.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const GlyphTrail = ({
  decay = 2.4,
  spread = 1.8,
  idle = true,
  hot = "orange",
  cool = "ink",
  charset = "standard",
  chars,
  colorMode,
  ramp = "ember",
  phosphor,
  grade,
  threshold,
  edgeThreshold,
  dither,
  background,
  fx,
  cell = 14,
  speed = 1,
  animate = true,
  fps = 60,
  stillTime = 7,
  handle,
  clearContent = true,
  children,
  className,
  ref,
  ...props
}: GlyphTrailProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRoot = (node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof ref === "function") {
      return ref(node);
    }
    if (ref) {
      ref.current = node;
    }
  };
  const preset = phosphor ? PHOSPHORS[phosphor] : undefined;
  const mode = colorMode ?? (preset ? "mono" : "truecolor");
  const fill = background ?? (preset ? "paper" : "transparent");
  const paperColor = preset?.paper ?? "--ascii-paper";
  const resolved = resolveCharset(charset, chars);
  const packed = resolved.kind === "braille" || resolved.kind === "quadrants";

  const theme = useAsciiColors(rootRef, [hot, cool, paperColor]);
  const lut = useMemo(() => {
    if (mode === "duotone") {
      // Skip the near-black foot of the ramp: it vanishes on dark paper.
      const stops = rampBytes(ramp);
      return buildLut(
        [0.3, 0.48, 0.66, 0.84, 1].map((t) => sampleRamp(stops, t))
      );
    }
    const hotRgb = toBytes(theme?.[0], [252, 180, 66]);
    const coolRgb = toBytes(theme?.[1], [240, 240, 240]);
    const paper = toBytes(theme?.[2], [0, 0, 0]);
    const onLight =
      (0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2]) / 255 > 0.55;
    // The core burns past the accent: paler on dark paper, deeper on light.
    const core = onLight
      ? mixRgb(hotRgb, [0, 0, 0], 0.28)
      : mixRgb(hotRgb, [255, 255, 255], 0.4);
    return buildLut([
      coolRgb,
      coolRgb,
      mixRgb(coolRgb, hotRgb, 0.6),
      hotRgb,
      core,
    ]);
  }, [mode, ramp, theme]);

  const reducedMotion = usePrefersReducedMotion();
  const still = reducedMotion || !animate;
  const inView = useInView(rootRef);
  const [pace, setPace] = useState<Pace>("calm");
  const paceRef = useRef<Pace>("calm");
  const trailRef = useRef<Trail | null>(null);
  const buffersRef = useRef<Buffers | null>(null);
  const queueRef = useRef<PointerQueue | null>(null);

  // Moves anywhere on the page are queued; the frame keeps the ones over
  // the box. Listening on window means nothing here needs pointer events,
  // and touch is read from touch events so dragging still scrolls.
  useEffect(() => {
    if (still || !inView) {
      return;
    }
    queueRef.current ??= createQueue();
    const queue = queueRef.current;
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    const push = (x: number, y: number, time: number, start: boolean) => {
      const moved = Math.hypot(x - lastX, y - lastY) > 1;
      lastX = x;
      lastY = y;
      const { data } = queue;
      if (queue.count >= QUEUE_SIZE) {
        data.copyWithin(0, 4);
        queue.count -= 1;
      }
      const at = queue.count * 4;
      data[at] = x;
      data[at + 1] = y;
      data[at + 2] = time;
      data[at + 3] = start ? 1 : 0;
      queue.count += 1;
      if (paceRef.current === "live" || !(moved || start)) {
        return;
      }
      const rect = rootRef.current?.getBoundingClientRect();
      const inside =
        rect !== undefined &&
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom;
      if (inside) {
        paceRef.current = "live";
        setPace("live");
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        push(event.clientX, event.clientY, event.timeStamp, false);
      }
    };
    const onTouch = (event: TouchEvent) => {
      const [touch] = event.touches;
      if (touch) {
        push(
          touch.clientX,
          touch.clientY,
          event.timeStamp,
          event.type === "touchstart"
        );
      }
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      queue.count = 0;
    };
  }, [still, inView]);

  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    time,
  }: AsciiGridDrawContext) => {
    trailRef.current ??= createTrail();
    const trail = trailRef.current;
    const [gx, gy] = resolved.grid;
    const key = `${columns}x${rows}:${gx}x${gy}`;
    if (buffersRef.current?.key !== key) {
      buffersRef.current = createBuffers(columns, rows, resolved, key);
    }
    const buffers = buffersRef.current;
    const scene: Scene = {
      cell: metrics.height,
      emit: {
        cell: metrics.height,
        decay: clamp(decay, 0.2, 10),
        spread: clamp(spread, 0.2, 6),
      },
      height: rows * metrics.height,
      idle,
      width: columns * metrics.width,
    };

    if (still) {
      warmUp(trail, stillTime, scene);
      trail.warmed = false;
    } else {
      const next = simulate(
        trail,
        time,
        queueRef.current,
        rootRef.current,
        scene,
        stillTime
      );
      if (next !== paceRef.current) {
        paceRef.current = next;
        setPace(next);
      }
    }

    buffers.heat.fill(0);
    buffers.temperature.fill(0);
    if (trail.count === 0) {
      return;
    }
    const root = rootRef.current;
    const now = performance.now();
    if (root && children && clearContent) {
      // Text rarely moves, so measure twice a second, and on every still frame.
      if (still || now - buffers.clearAt > 500) {
        buffers.clearAt = now;
        measureClearance(
          buffers.clear,
          columns,
          rows,
          [metrics.width, metrics.height],
          contentRects(root)
        );
      }
    } else if (buffers.clearAt > Number.NEGATIVE_INFINITY) {
      buffers.clearAt = Number.NEGATIVE_INFINITY;
      buffers.clear.fill(1);
    }
    const sampleWidth = metrics.width / gx;
    const sampleHeight = metrics.height / gy;
    splatPuffs(trail, buffers, sampleWidth, sampleHeight);
    shadeField(
      buffers,
      columns,
      [gx, gy],
      [sampleWidth, sampleHeight],
      metrics.height,
      trail.clock
    );
    const colored = mode !== "mono";
    mapTones(
      buffers.field,
      columns,
      rows,
      {
        charset: resolved,
        colorMode: colored ? "truecolor" : "mono",
        dither: dither ?? (packed ? "bayer4" : "none"),
        edgeThreshold,
        grade,
        threshold,
      },
      frame
    );
    if (colored) {
      tintFrame(frame, buffers.cells, lut);
    }
  };

  const running = !still && pace !== "asleep";
  return (
    <div
      ref={setRoot}
      className={cn(
        "relative isolate",
        children ? null : "pointer-events-none",
        className
      )}
      {...props}
    >
      <AsciiGrid
        draw={draw}
        cell={cell}
        ink={preset?.ink ?? cool}
        paper={fill === "paper" ? paperColor : "transparent"}
        colored={mode !== "mono"}
        speed={speed}
        animate={running}
        fps={pace === "live" ? fps : Math.min(fps, 30)}
        stillTime={stillTime}
        handle={handle}
        fx={fx}
        className="absolute inset-0 -z-10"
      />
      {children}
    </div>
  );
};
