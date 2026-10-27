"use client";

import { useRef } from "react";

import {
  ANSI16,
  AsciiGrid,
  createToneField,
  gradeRgb,
  hexToRgb,
  luma,
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

/** What stands on the horizon under the flock. */
export type MurmurationHorizon = "reeds" | "trees" | "none";

export interface MurmurationSceneProps extends AsciiSceneProps {
  /** How many starlings, 200 to 6000. Default 3000. */
  birds?: number;
  /** How tightly each bird keeps to its neighbours, 0 to 3. Default 1. */
  cohesion?: number;
  /** How hard the slow wind folds the flock into ribbons and balls, 0 to 3. Default 1. */
  fold?: number;
  /** A hawk crosses now and then while the pointer is away. Default `true`. */
  hawk?: boolean;
  /** The silhouette along the bottom: a reed bed before a tree line, the trees alone, or open sky. Default `"reeds"`. */
  horizon?: MurmurationHorizon;
}

// Dusk from the top of the sky down to the horizon. Glow colours light up
// toward the sun over dark glass; ink colours stipple a glowing paper and
// thin out toward the horizon, the way a print darkens a sky.
const DUSK_GLOW = ["#1c2556", "#4a3a7e", "#9a4f88", "#e2706a", "#ffb36b"].map(
  hexToRgb
);
const DUSK_INK = ["#11143a", "#262566", "#55307a", "#933f73", "#c95c62"].map(
  hexToRgb
);

const SCENE = {
  /** Behind the glyphs in mono and palette before the theme resolves. */
  backdrop: "#120e20",
  /** The glowing dusk paper of truecolor and ansi16. */
  paper: "#eea377",
  silhouette: hexToRgb("#07040b"),
  sun: hexToRgb("#fff1d2"),
} as const;

const DEFAULT_FX: PostFx = { bloom: 0.25 };

/** Where the sky meets the land, as a share of the box height. */
const HORIZON = 0.88;

/** A numeric read that treats a missing index as 0. */
const read = (data: ArrayLike<number>, index: number): number =>
  data[index] ?? 0;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** A small seeded generator, so every mount and still frame match. */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state += 1;
    const wave = Math.sin(state * 12.9898 + seed * 78.233) * 43_758.5453;
    return wave - Math.floor(wave);
  };
};

// --- The flock --------------------------------------------------------------------

/**
 * Boids in box-height units: x runs 0 to `aspect`, y 0 (top) to 1. A
 * uniform grid of `reach`-sized cells, rebuilt by counting sort each step,
 * keeps neighbour search linear in the number of birds.
 */
interface Flock {
  readonly key: string;
  readonly count: number;
  readonly aspect: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly nextVx: Float32Array;
  readonly nextVy: Float32Array;
  /** Agitation, 0 to 1. It hops from bird to bird, so a scare ripples outward. */
  readonly panic: Float32Array;
  readonly nextPanic: Float32Array;
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly cellStart: Int32Array;
  readonly cellOf: Int32Array;
  /** Per grid cell: birds placed so far while sorting. */
  readonly cursor: Int32Array;
  readonly order: Int32Array;
  readonly hawk: Hawk;
  time: number;
}

interface Hawk {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 to 1: how present the hawk is, faded in and out. */
  presence: number;
  /** Seconds left in a dive. */
  dive: number;
  wasDown: boolean;
}

/** Neighbour radius. Starlings watch a handful of birds close by. */
const REACH = 0.046;
const SPACING = 0.021;
/** Neighbours a bird reacts to, and how many it looks at before it stops. */
const NEIGHBOURS = 9;
const CANDIDATES = 48;
const DIVE_SECONDS = 1.1;
/** How far from the attractor a bird roams before it is pulled back. */
const LOOSE = 0.12;

const createFlock = (count: number, aspect: number, key: string): Flock => {
  const random = seeded(count * 31 + 7);
  const make = () => new Float32Array(count);
  const x = make();
  const y = make();
  const vx = make();
  const vy = make();
  // Start as two loose clouds drifting the same way.
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? 0.35 : 0.62;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 0.16;
    x[i] = aspect * side + Math.cos(angle) * radius;
    y[i] = 0.4 + Math.sin(angle) * radius * 0.7;
    vx[i] = 0.26 + random() * 0.04;
    vy[i] = (random() - 0.5) * 0.06;
  }
  const gridWidth = Math.ceil(aspect / REACH) + 1;
  const gridHeight = Math.ceil(1 / REACH) + 1;
  return {
    aspect,
    cellOf: new Int32Array(count),
    cellStart: new Int32Array(gridWidth * gridHeight + 1),
    count,
    cursor: new Int32Array(gridWidth * gridHeight),
    gridHeight,
    gridWidth,
    hawk: { dive: 0, presence: 0, vx: 0, vy: 0, wasDown: false, x: -1, y: -1 },
    key,
    nextPanic: make(),
    nextVx: make(),
    nextVy: make(),
    order: new Int32Array(count),
    panic: make(),
    time: 0,
    vx,
    vy,
    x,
    y,
  };
};

/** Bucket every bird into its grid cell (counting sort). */
const bucket = (flock: Flock) => {
  const {
    count,
    x,
    y,
    gridWidth,
    gridHeight,
    cellStart,
    cellOf,
    order,
    cursor,
  } = flock;
  cellStart.fill(0);
  for (let i = 0; i < count; i += 1) {
    const gx = Math.min(
      gridWidth - 1,
      Math.max(0, Math.floor(read(x, i) / REACH))
    );
    const gy = Math.min(
      gridHeight - 1,
      Math.max(0, Math.floor(read(y, i) / REACH))
    );
    const cell = gy * gridWidth + gx;
    cellOf[i] = cell;
    cellStart[cell + 1] = read(cellStart, cell + 1) + 1;
  }
  for (let cell = 1; cell < cellStart.length; cell += 1) {
    cellStart[cell] = read(cellStart, cell) + read(cellStart, cell - 1);
  }
  cursor.fill(0);
  for (let i = 0; i < count; i += 1) {
    const cell = read(cellOf, i);
    order[read(cellStart, cell) + read(cursor, cell)] = i;
    cursor[cell] = read(cursor, cell) + 1;
  }
};

interface Forces {
  readonly cohesion: number;
  readonly fold: number;
  readonly hawk: boolean;
}

/** Where the pointer is, in flock units, if it is over the scene. */
interface Hunt {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}

const IDLE_HUNT: Hunt = { active: false, down: false, x: 0, y: 0 };

/** The idle hawk: one pass across the sky every 17 s. */
const IDLE_PERIOD = 17;
const IDLE_START = 8;
const IDLE_LENGTH = 4;

const idleHawk = (flock: Flock, t: number): { x: number; y: number } | null => {
  const lap = Math.floor(t / IDLE_PERIOD);
  const phase = t - lap * IDLE_PERIOD - IDLE_START;
  if (phase < 0 || phase > IDLE_LENGTH) {
    return null;
  }
  const u = phase / IDLE_LENGTH;
  const across = lap % 2 === 0 ? u : 1 - u;
  return {
    x: flock.aspect * (-0.08 + 1.16 * across),
    y: 0.16 + 0.34 * Math.sin(Math.PI * u) + 0.05 * Math.sin(lap * 2.3),
  };
};

/** Move the hawk toward the pointer, or along its idle pass. */
const steerHawk = (flock: Flock, hunt: Hunt, forces: Forces, dt: number) => {
  const { hawk } = flock;
  const idle = forces.hawk && !hunt.active ? idleHawk(flock, flock.time) : null;
  const target = hunt.active ? hunt : idle;
  if (target) {
    if (hawk.presence <= 0.01) {
      hawk.x = target.x;
      hawk.y = target.y;
    }
    const follow = 1 - Math.exp(-dt * (hunt.active ? 14 : 6));
    const nx = hawk.x + (target.x - hawk.x) * follow;
    const ny = hawk.y + (target.y - hawk.y) * follow;
    const smooth = 1 - Math.exp(-dt * 8);
    hawk.vx += ((nx - hawk.x) / dt - hawk.vx) * smooth;
    hawk.vy += ((ny - hawk.y) / dt - hawk.vy) * smooth;
    hawk.x = nx;
    hawk.y = ny;
  }
  hawk.presence = clamp01(hawk.presence + (target ? dt * 4 : -dt * 2.5));
  // A press stoops: a short dive that scatters a wide hole.
  const pressed = hunt.down && !hawk.wasDown;
  hawk.wasDown = hunt.down;
  if (pressed) {
    hawk.dive = DIVE_SECONDS;
  }
  hawk.dive = Math.max(0, hawk.dive - dt);
};

/** What one bird sees of its neighbours. Reused, so a step allocates nothing. */
const senses = {
  fear: 0,
  pushX: 0,
  pushY: 0,
  seen: 0,
  sumVx: 0,
  sumVy: 0,
  sumX: 0,
  sumY: 0,
};

/** Look through the 3x3 grid cells around bird `i`, up to `CANDIDATES` birds. */
const sense = (flock: Flock, i: number): typeof senses => {
  const {
    x,
    y,
    vx,
    vy,
    panic,
    gridWidth,
    gridHeight,
    cellStart,
    cellOf,
    order,
  } = flock;
  const px = read(x, i);
  const py = read(y, i);
  const cell = read(cellOf, i);
  const cx = cell % gridWidth;
  const cy = (cell - cx) / gridWidth;
  senses.seen = 0;
  senses.sumVx = 0;
  senses.sumVy = 0;
  senses.sumX = 0;
  senses.sumY = 0;
  senses.pushX = 0;
  senses.pushY = 0;
  senses.fear = 0;
  let looked = 0;
  const top = Math.max(0, cy - 1);
  const bottom = Math.min(gridHeight - 1, cy + 1);
  const left = Math.max(0, cx - 1);
  const right = Math.min(gridWidth - 1, cx + 1);
  for (let ny = top; ny <= bottom; ny += 1) {
    // Each row of three grid cells is one run in the sorted order.
    const end = read(cellStart, ny * gridWidth + right + 1);
    for (let k = read(cellStart, ny * gridWidth + left); k < end; k += 1) {
      const j = read(order, k);
      looked += 1;
      if (looked > CANDIDATES || senses.seen >= NEIGHBOURS) {
        return senses;
      }
      const dx = px - read(x, j);
      const dy = py - read(y, j);
      const d2 = dx * dx + dy * dy;
      if (j !== i && d2 < REACH * REACH) {
        senses.seen += 1;
        senses.sumVx += read(vx, j);
        senses.sumVy += read(vy, j);
        senses.sumX += read(x, j);
        senses.sumY += read(y, j);
        senses.fear = Math.max(senses.fear, read(panic, j));
        if (d2 < SPACING * SPACING) {
          const d = Math.sqrt(d2) + 1e-5;
          const shove = (SPACING - d) / (SPACING * d);
          senses.pushX += dx * shove;
          senses.pushY += dy * shove;
        }
      }
    }
  }
  return senses;
};

const step = (flock: Flock, dt: number, forces: Forces, hunt: Hunt) => {
  steerHawk(flock, hunt, forces, dt);
  bucket(flock);
  const {
    count,
    aspect,
    x,
    y,
    vx,
    vy,
    nextVx,
    nextVy,
    panic,
    nextPanic,
    hawk,
  } = flock;
  const t = flock.time;
  const { cohesion, fold } = forces;

  // The slow attractor wanders the sky; the flock orbits it, and the
  // orbit's sense flips now and then, which folds sheets back on themselves.
  const targetX = aspect * (0.5 + 0.2 * Math.sin(t * 0.083 + 0.6));
  const targetY = 0.46 + 0.1 * Math.sin(t * 0.131 + 1.9);
  const pull = 2.2 * fold;
  const orbit = 0.55 * fold * Math.sin(t * 0.071);
  const shear = 0.38 * fold;

  const dive = hawk.dive > 0 ? hawk.dive / DIVE_SECONDS : 0;
  const hawkReach = (0.13 + 0.2 * dive) * hawk.presence;
  const flee = 4.5 + 9 * dive;
  const panicKeep = Math.exp(-dt * 1.6);

  for (let i = 0; i < count; i += 1) {
    const px = read(x, i);
    const py = read(y, i);
    const pvx = read(vx, i);
    const pvy = read(vy, i);
    const { seen, sumVx, sumVy, sumX, sumY, pushX, pushY, fear } = sense(
      flock,
      i
    );

    let ax = 0;
    let ay = 0;
    if (seen > 0) {
      ax += (sumVx / seen - pvx) * 2.4;
      ay += (sumVy / seen - pvy) * 2.4;
      ax += (sumX / seen - px) * 5 * cohesion;
      ay += (sumY / seen - py) * 5 * cohesion;
      ax += pushX * 2.6;
      ay += pushY * 2.6;
    }

    // The attractor only pulls birds that stray far from it, so the flock
    // keeps its own shape inside that reach.
    const tx = targetX - px;
    const ty = targetY - py;
    const away = Math.hypot(tx, ty) + 1e-4;
    const stray = Math.max(0, away - LOOSE) / away;
    ax += tx * pull * stray - ty * orbit;
    ay += ty * pull * stray + tx * orbit;
    // A shear wind around the attractor, opposite on either side of it,
    // drags the flock out into ribbons without carrying it away.
    ax += Math.sin(ty * 8.3 + t * 0.37) * shear;
    ay += Math.sin(tx * 5.1 - t * 0.29) * shear * 0.5;

    // Keep to the sky above the reeds.
    if (px < 0.04 * aspect) {
      ax += (0.04 * aspect - px) * 30;
    } else if (px > 0.96 * aspect) {
      ax -= (px - 0.96 * aspect) * 30;
    }
    if (py < 0.08) {
      ay += (0.08 - py) * 30;
    } else if (py > HORIZON - 0.14) {
      ay -= (py - (HORIZON - 0.14)) * 30;
    }

    let scared = Math.max(read(panic, i) * panicKeep, fear * 0.86 - 0.02);
    if (hawkReach > 0) {
      const hx = px - hawk.x;
      const hy = py - hawk.y;
      const d = Math.hypot(hx, hy) + 1e-4;
      if (d < hawkReach) {
        const near = 1 - d / hawkReach;
        ax += (hx / d) * flee * near * near * 3;
        ay += (hy / d) * flee * near * near * 3;
        scared = Math.max(scared, Math.min(1, near * 2.2));
      }
    }
    nextPanic[i] = Math.max(0, scared);

    // A scared bird jinks sideways: the agitation wave seen in real flocks.
    const jink = (i % 2 === 0 ? 1 : -1) * scared * 1.4;
    ax += -pvy * jink;
    ay += pvx * jink;

    let nvx = pvx + ax * dt;
    let nvy = pvy + ay * dt;
    const speed = Math.hypot(nvx, nvy) + 1e-6;
    const top = 0.4 * (1 + 0.9 * scared);
    const bottom = 0.18;
    const limited = Math.min(top, Math.max(bottom, speed));
    nvx = (nvx / speed) * limited;
    nvy = (nvy / speed) * limited;
    nextVx[i] = nvx;
    nextVy[i] = nvy;
  }

  for (let i = 0; i < count; i += 1) {
    const nvx = read(nextVx, i);
    const nvy = read(nextVy, i);
    vx[i] = nvx;
    vy[i] = nvy;
    x[i] = read(x, i) + nvx * dt;
    y[i] = read(y, i) + nvy * dt;
  }
  panic.set(nextPanic);
  flock.time += dt;
};

const FIXED_STEP = 1 / 30;

/** A fresh flock, flown ahead so its first frame already shows a murmuration. */
const warmFlock = (
  time: number,
  count: number,
  aspect: number,
  forces: Forces,
  key: string
): Flock => {
  const flock = createFlock(count, aspect, key);
  flock.time = Math.max(0, time - 5);
  const calm: Forces = { ...forces, hawk: false };
  for (let warm = 0; warm < 150; warm += 1) {
    step(flock, FIXED_STEP, calm, IDLE_HUNT);
  }
  return flock;
};

// --- The sky ----------------------------------------------------------------------

/**
 * Everything drawn at the charset's sample grid. The sky's haze, its
 * colours and the tree line only change on resize, so they are worked out
 * once; birds and swaying reeds are splatted in every frame.
 */
interface Sky {
  readonly key: string;
  readonly field: ToneField;
  readonly aspect: number;
  readonly gx: number;
  readonly gy: number;
  /** Stippled sky glow, per sample. */
  readonly haze: Float32Array;
  /** Silhouette share per sample: trees, then reeds each frame. */
  readonly cover: Float32Array;
  readonly baseCover: Float32Array;
  /** Bird density per sample. */
  readonly density: Float32Array;
  /** How much of each sample's tone is silhouette, 0 (sky) to 1. */
  readonly share: Float32Array;
  /** Sky colour and brightness per cell. */
  readonly skyRgb: Uint8ClampedArray;
  readonly skyLevel: Float32Array;
  /** Reed stalks: x, height, sway phase, head flag. */
  readonly reeds: Float32Array;
}

const sunAt = (aspect: number) => ({ x: aspect * 0.71, y: HORIZON - 0.05 });

/** A repeatable 0..1 hash of an integer, for per-crown sizes. */
const hash = (n: number) => {
  const wave = Math.sin(n * 127.1 + 311.7) * 43_758.5453;
  return wave - Math.floor(wave);
};

const CROWN = 0.045;

/** The tone of one sky speck in a ramp charset: its lightest glyphs. */
const RAMP_HAZE = 0.1;

/** The tree line's top edge at x: overlapping round crowns of a few sizes. */
const treeTop = (x: number) => {
  const slot = Math.floor(x / CROWN);
  let top = HORIZON - 0.005;
  for (let k = slot - 1; k <= slot + 1; k += 1) {
    const centre = (k + 0.2 + 0.6 * hash(k)) * CROWN;
    const radius = CROWN * (0.45 + 0.5 * hash(k + 91));
    const trunk = 0.008 + 0.03 * hash(k + 37) ** 2;
    const dx = x - centre;
    if (Math.abs(dx) < radius) {
      top = Math.min(
        top,
        HORIZON - trunk - Math.sqrt(radius * radius - dx * dx) * 0.8
      );
    }
  }
  return top;
};

interface SkyOptions {
  readonly columns: number;
  readonly rows: number;
  readonly aspect: number;
  readonly gx: number;
  readonly gy: number;
  readonly horizon: MurmurationHorizon;
  /** Ink darker than its paper: the sky stipples darkest at the top. */
  readonly darkInk: boolean;
  /** Braille or quadrants: haze shows as dot coverage, not glyph weight. */
  readonly packed: boolean;
  readonly key: string;
}

const createSky = ({
  columns,
  rows,
  aspect,
  gx,
  gy,
  horizon,
  darkInk,
  packed,
  key,
}: SkyOptions): Sky => {
  const field = createToneField(columns, rows, {
    glyphs: [" ", "#"],
    grid: [gx, gy],
    id: "murmuration",
    kind: "ramp",
    label: "murmuration",
  });
  const { width, height } = field;
  const size = width * height;
  const haze = new Float32Array(size);
  const baseCover = new Float32Array(size);
  const sun = sunAt(aspect);
  const land = horizon === "none" ? 1.01 : HORIZON;
  for (let sy = 0; sy < height; sy += 1) {
    const y = (sy + 0.5) / height;
    const depth = clamp01(y / land);
    for (let sx = 0; sx < width; sx += 1) {
      const x = ((sx + 0.5) / width) * aspect;
      const index = sy * width + sx;
      const dx = x - sun.x;
      const dy = (y - sun.y) * 1.3;
      const glow = Math.exp(-(dx * dx + dy * dy) / 0.03);
      const sky = darkInk
        ? (0.03 + 0.4 * (1 - depth) ** 1.5) * (1 - 0.9 * glow)
        : 0.04 + 0.2 * depth ** 2 + 0.18 * glow;
      // A ramp draws a glyph for any tone at all, so its sky is a sparse
      // scatter of one light glyph rather than a gradient of many.
      const speck = hash(index) < sky * 0.55 ? RAMP_HAZE : 0;
      haze[index] = packed ? Math.min(1, sky) : speck;
      if (horizon !== "none" && y > treeTop(x)) {
        baseCover[index] = 0.88;
      }
      if (horizon !== "none" && y > HORIZON + 0.06) {
        baseCover[index] = 1;
      }
    }
  }

  const skyRgb = new Uint8ClampedArray(columns * rows * 3);
  const skyLevel = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    const y = (row + 0.5) / rows;
    const depth = clamp01(y / land);
    for (let column = 0; column < columns; column += 1) {
      const x = ((column + 0.5) / columns) * aspect;
      const dx = x - sun.x;
      const dy = (y - sun.y) * 1.3;
      const glow = Math.exp(-(dx * dx + dy * dy) / 0.02);
      const [r, g, b] = sampleRamp(
        darkInk ? DUSK_INK : DUSK_GLOW,
        depth ** 1.25
      );
      const cell = row * columns + column;
      skyRgb[cell * 3] = r + (read(SCENE.sun, 0) - r) * glow;
      skyRgb[cell * 3 + 1] = g + (read(SCENE.sun, 1) - g) * glow;
      skyRgb[cell * 3 + 2] = b + (read(SCENE.sun, 2) - b) * glow;
      skyLevel[cell] = darkInk
        ? 0.62 - 0.3 * depth
        : Math.min(1, 0.28 + 0.4 * depth + 0.4 * glow);
    }
  }

  // About one reed per 0.012 box heights, seeded so they stay put.
  const random = seeded(columns * 7 + rows);
  const reedCount = horizon === "reeds" ? Math.ceil(aspect / 0.012) : 0;
  const reeds = new Float32Array(reedCount * 4);
  for (let i = 0; i < reedCount; i += 1) {
    reeds[i * 4] = (i + random() * 0.9) * (aspect / reedCount);
    reeds[i * 4 + 1] = 0.05 + random() ** 2 * 0.13;
    reeds[i * 4 + 2] = random() * Math.PI * 2;
    reeds[i * 4 + 3] = random() < 0.35 ? 1 : 0;
  }

  return {
    aspect,
    baseCover,
    cover: new Float32Array(size),
    density: new Float32Array(size),
    field,
    gx,
    gy,
    haze,
    key,
    reeds,
    share: new Float32Array(size),
    skyLevel,
    skyRgb,
  };
};

/** Sway the reeds in the wind and rasterise them, one sample wide. */
const drawReeds = (sky: Sky, t: number) => {
  const { field, reeds, cover, aspect } = sky;
  const { width, height } = field;
  const base = HORIZON + 0.08;
  const gust = 0.5 + 0.5 * Math.sin(t * 0.4);
  for (let i = 0; i < reeds.length; i += 4) {
    const rootX = read(reeds, i);
    const tall = read(reeds, i + 1);
    const phase = read(reeds, i + 2);
    const head = read(reeds, i + 3) > 0;
    const sway =
      (0.25 + 0.75 * gust) * 0.05 * Math.sin(t * 1.3 + phase) + 0.02 * gust;
    const top = Math.max(0, Math.floor((base - tall) * height));
    const bottom = Math.min(height - 1, Math.floor(base * height));
    for (let sy = top; sy <= bottom; sy += 1) {
      const lift = (base - (sy + 0.5) / height) / tall;
      const x = rootX + sway * tall * lift * lift * 4;
      const sx = Math.floor((x / aspect) * width);
      if (sx < 0 || sx >= width) {
        continue;
      }
      cover[sy * width + sx] = 1;
      // A seed head: a short fat stretch near the tip.
      if (head && lift > 0.72 && lift < 0.95 && sx + 1 < width) {
        cover[sy * width + sx + 1] = 1;
      }
    }
  }
};

/** Splat one bird into the density buffer. */
const splatBird = (
  sky: Sky,
  x: number,
  y: number,
  weight: number,
  smooth: boolean
) => {
  const { field, density, aspect } = sky;
  const { width, height } = field;
  const fx = (x / aspect) * width - (smooth ? 0.5 : 0);
  const fy = y * height - (smooth ? 0.5 : 0);
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  if (!smooth) {
    if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
      const at = iy * width + ix;
      density[at] = read(density, at) + weight;
    }
    return;
  }
  const wx = fx - ix;
  const wy = fy - iy;
  for (let oy = 0; oy <= 1; oy += 1) {
    const sy = iy + oy;
    if (sy < 0 || sy >= height) {
      continue;
    }
    const wRow = oy === 0 ? 1 - wy : wy;
    for (let ox = 0; ox <= 1; ox += 1) {
      const sx = ix + ox;
      if (sx < 0 || sx >= width) {
        continue;
      }
      const at = sy * width + sx;
      density[at] =
        read(density, at) + weight * wRow * (ox === 0 ? 1 - wx : wx);
    }
  }
};

/** The hawk: a chevron of heavy splats, wings swept back in a dive. */
const drawHawk = (sky: Sky, flock: Flock, smooth: boolean) => {
  const { hawk } = flock;
  if (hawk.presence < 0.05) {
    return;
  }
  const speed = Math.hypot(hawk.vx, hawk.vy);
  const headX = speed > 0.02 ? hawk.vx / speed : 1;
  const headY = speed > 0.02 ? hawk.vy / speed : 0;
  const dive = hawk.dive > 0 ? hawk.dive / DIVE_SECONDS : 0;
  const span = 0.05 * (1 - 0.55 * dive);
  const sweep = 0.018 + 0.04 * dive;
  const flap = Math.sin(flock.time * 9) * 0.006 * (1 - dive);
  const weight = 4 * hawk.presence;
  const steps = 14;
  for (let k = -steps; k <= steps; k += 1) {
    const u = k / steps;
    const out = Math.abs(u);
    const back = sweep * out - flap * out * out;
    const x = hawk.x - headX * back - headY * span * u;
    const y = hawk.y - headY * back + headX * span * u;
    splatBird(sky, x, y, weight, smooth);
    // Thicker near the body, so the bird reads at Braille's dot size.
    if (out < 0.6) {
      splatBird(sky, x - headX * 0.006, y - headY * 0.006, weight, smooth);
    }
  }
  splatBird(
    sky,
    hawk.x - headX * 0.012,
    hawk.y - headY * 0.012,
    weight,
    smooth
  );
};

/** Compose sky, birds and silhouettes into tones and silhouette shares. */
const render = (sky: Sky, flock: Flock, packed: boolean, reeds: boolean) => {
  const { field, haze, cover, baseCover, density, share, gx, gy } = sky;
  density.fill(0);
  cover.set(baseCover);
  if (reeds) {
    drawReeds(sky, flock.time);
  }
  // Braille dots and quadrants: one bird, one dot. Ramps blend birds
  // across cells so they glide instead of stepping.
  const smooth = !packed;
  const { count, x, y, panic } = flock;
  for (let i = 0; i < count; i += 1) {
    // Banking birds show more of their wings: scares darken as they pass.
    splatBird(sky, read(x, i), read(y, i), 1 + 0.9 * read(panic, i), smooth);
  }
  drawHawk(sky, flock, smooth);

  // A sample's bird tone grows with the birds in it; samples of ramp
  // charsets are a whole cell, so each bird counts for less there.
  const gain = 1.3 * ((gx * gy) / 8);
  const { tones } = field;
  for (let index = 0; index < tones.length; index += 1) {
    const solid = read(cover, index);
    if (solid > 0) {
      tones[index] = 1;
      share[index] = solid;
      continue;
    }
    const birds = 1 - Math.exp(-read(density, index) * gain);
    const tone = 1 - (1 - read(haze, index)) * (1 - birds);
    tones[index] = tone;
    share[index] = tone > 0 ? birds / tone : 0;
  }
};

// --- Colour ---------------------------------------------------------------------

/**
 * How a look colours a cell. Colour modes mix each cell from its sky
 * colour toward the silhouette, so birds and reeds go dark against the
 * glow. Mono and palette light birds in full ink over a dimmer sky.
 */
interface Shading {
  readonly key: string;
  readonly mode: "rgb" | "ansi" | "ramp" | "level";
  /** Ink darker than paper, as with the dusk paper or a light theme. */
  readonly darkInk: boolean;
  /** 64 colours by level, for `ramp` and `level`. */
  readonly levels: Uint8ClampedArray;
  /** ANSI index per 5-bit RGB, -1 until looked up. */
  readonly ansiIndex: Int16Array;
  readonly ansiTable: readonly Rgb8[];
}

const LEVELS = 64;

const fillLevels = (levels: Uint8ClampedArray, color: (t: number) => Rgb8) => {
  for (let i = 0; i < LEVELS; i += 1) {
    levels.set(color(i / (LEVELS - 1)), i * 3);
  }
};

const toBytes = (rgba: readonly number[] | undefined, fallback: Rgb8): Rgb8 =>
  rgba
    ? [read(rgba, 0) * 255, read(rgba, 1) * 255, read(rgba, 2) * 255]
    : fallback;

type ShadingLook = Pick<
  AsciiSceneProps,
  "colorMode" | "phosphor" | "ramp" | "ansi"
>;

const createShading = (
  look: ShadingLook,
  tokens: readonly (readonly number[])[] | null,
  key: string
): Shading => {
  const { colorMode = "truecolor" } = look;
  const levels = new Uint8ClampedArray(LEVELS * 3);
  const ansiTable = ANSI16[look.ansi ?? "vga"];
  const base = {
    ansiIndex: new Int16Array(colorMode === "ansi16" ? 32_768 : 0).fill(-1),
    ansiTable,
    key,
    levels,
  };
  if (colorMode === "duotone") {
    const ramp = look.ramp ?? "ember";
    const stops = (typeof ramp === "string" ? RAMPS[ramp] : ramp).map(hexToRgb);
    fillLevels(levels, (t) => sampleRamp(stops, 0.1 + 0.9 * t));
    return { ...base, darkInk: false, mode: "ramp" };
  }
  if (colorMode === "mono" || colorMode === "palette") {
    const glass =
      colorMode === "mono" && look.phosphor ? PHOSPHORS[look.phosphor] : null;
    const ink = glass
      ? hexToRgb(glass.ink)
      : toBytes(tokens?.[0], [230, 230, 240]);
    const paper = glass
      ? hexToRgb(glass.paper)
      : toBytes(tokens?.[1], hexToRgb(SCENE.backdrop));
    fillLevels(levels, (t) => {
      const mixT = 0.16 + 0.84 * t;
      return [
        paper[0] + (ink[0] - paper[0]) * mixT,
        paper[1] + (ink[1] - paper[1]) * mixT,
        paper[2] + (ink[2] - paper[2]) * mixT,
      ];
    });
    return {
      ...base,
      darkInk: luma(...paper) > luma(...ink),
      mode: "level",
    };
  }
  return {
    ...base,
    darkInk: true,
    mode: colorMode === "ansi16" ? "ansi" : "rgb",
  };
};

/** Ink and paper for a look: phosphor, ramp, theme tokens or the dusk backdrop. */
const surfaceColors = (
  look: Pick<AsciiSceneProps, "colorMode" | "phosphor" | "ramp" | "background">
): { ink: string; paper: string } => {
  const { colorMode = "truecolor", phosphor, background = "paper" } = look;
  const ink =
    colorMode === "mono" && phosphor ? PHOSPHORS[phosphor].ink : "--ascii-ink";
  if (background === "transparent") {
    return { ink, paper: "transparent" };
  }
  if (colorMode === "mono") {
    return {
      ink,
      paper: phosphor ? PHOSPHORS[phosphor].paper : "--ascii-paper",
    };
  }
  if (colorMode === "palette") {
    return { ink, paper: "--ascii-paper" };
  }
  if (colorMode === "duotone") {
    const ramp = look.ramp ?? "ember";
    const darkest = typeof ramp === "string" ? RAMPS[ramp][0] : ramp[0];
    return { ink, paper: darkest ?? SCENE.backdrop };
  }
  return { ink, paper: SCENE.paper };
};

const writeLevel = (
  colors: Uint8ClampedArray,
  cell: number,
  levels: Uint8ClampedArray,
  level: number
) => {
  const at = Math.round(clamp01(level) * (LEVELS - 1)) * 3;
  colors[cell * 4] = read(levels, at);
  colors[cell * 4 + 1] = read(levels, at + 1);
  colors[cell * 4 + 2] = read(levels, at + 2);
  colors[cell * 4 + 3] = 255;
};

/** Colour every inked cell from its sky colour and silhouette share. */
const colorCells = (
  sky: Sky,
  frame: MutableFrame,
  shading: Shading,
  grade: AsciiSceneProps["grade"]
) => {
  const { field, share, cover, gx, gy, skyRgb, skyLevel } = sky;
  const { colors, glyphs, columns, rows } = frame;
  if (!colors) {
    return;
  }
  const [sr, sg, sb] = SCENE.silhouette;
  const { levels, ansiIndex, ansiTable } = shading;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cell = row * columns + column;
      if (glyphs[cell] === " ") {
        continue;
      }
      let dark = 0;
      let land = 0;
      let weight = 0;
      for (let dy = 0; dy < gy; dy += 1) {
        const at = (row * gy + dy) * field.width + column * gx;
        for (let dx = 0; dx < gx; dx += 1) {
          const tone = read(field.tones, at + dx);
          dark += read(share, at + dx) * tone;
          land += read(cover, at + dx) * tone;
          weight += tone;
        }
      }
      // A few birds shade a cell; a knot of them blacks it out.
      const s = weight > 0 ? Math.min(1, (dark / weight) * 1.25) : 0;
      if (shading.mode === "level" || shading.mode === "ramp") {
        const level = read(skyLevel, cell);
        // On dark glass the land stays dim so the birds keep the light.
        const ground = shading.darkInk || weight === 0 ? 0 : land / weight;
        const lit = level + (1 - level) * s;
        writeLevel(colors, cell, levels, lit + (0.3 - lit) * ground);
        continue;
      }
      const r = read(skyRgb, cell * 3);
      const g = read(skyRgb, cell * 3 + 1);
      const b = read(skyRgb, cell * 3 + 2);
      const mr = r + (sr - r) * s;
      const mg = g + (sg - g) * s;
      const mb = b + (sb - b) * s;
      if (shading.mode === "ansi") {
        const quantized =
          Math.floor(mr / 8) * 1024 +
          Math.floor(mg / 8) * 32 +
          Math.floor(mb / 8);
        let index = read(ansiIndex, quantized);
        if (index < 0) {
          index = nearestIndex(gradeRgb([mr, mg, mb], grade), ansiTable);
          ansiIndex[quantized] = index;
        }
        const [ar, ag, ab] = ansiTable[index] ?? SCENE.silhouette;
        colors[cell * 4] = ar;
        colors[cell * 4 + 1] = ag;
        colors[cell * 4 + 2] = ab;
        colors[cell * 4 + 3] = 255;
        continue;
      }
      if (grade) {
        const [gr, gg, gb] = gradeRgb([mr, mg, mb], grade);
        colors[cell * 4] = gr;
        colors[cell * 4 + 1] = gg;
        colors[cell * 4 + 2] = gb;
      } else {
        colors[cell * 4] = mr;
        colors[cell * 4 + 1] = mg;
        colors[cell * 4 + 2] = mb;
      }
      colors[cell * 4 + 3] = 255;
    }
  }
};

// --- The scene ------------------------------------------------------------------

const clampKnob = (value: number) => Math.min(3, Math.max(0, value));

/** The pointer in flock units. */
const readHunt = (
  flock: Flock,
  { pointer, columns, rows }: AsciiGridDrawContext,
  interactive: boolean
): Hunt => {
  if (!(interactive && pointer.inside)) {
    return IDLE_HUNT;
  }
  return {
    active: true,
    down: pointer.down,
    x: (pointer.x / columns) * flock.aspect,
    y: pointer.y / rows,
  };
};

/**
 * Starling Murmuration. A few thousand boids flock at dusk: separation,
 * alignment and cohesion between near neighbours, and a slow wandering
 * attractor with a shear wind that folds the flock into ribbons, sheets
 * and balls. Each bird lands in the tone field at the charset's sample
 * grid, so knots go dense and dark while the edges stay thin. The pointer
 * is a hawk: the flock opens around it and scares ripple outward from
 * bird to bird. Press to dive.
 */
export const MurmurationScene = ({
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
  birds = 3000,
  cohesion = 1,
  fold = 1,
  hawk = true,
  horizon = "reeds",
  className,
  ...props
}: MurmurationSceneProps) => {
  const flockRef = useRef<Flock | null>(null);
  const skyRef = useRef<Sky | null>(null);
  const shadingRef = useRef<Shading | null>(null);
  const tokens = useAsciiColors();

  const surface = surfaceColors({ background, colorMode, phosphor, ramp });
  const forces: Forces = {
    cohesion: clampKnob(cohesion),
    fold: clampKnob(fold),
    hawk,
  };
  const count = Math.round(Math.min(6000, Math.max(200, birds)));
  const rampKey = typeof ramp === "string" ? ramp : (ramp ?? []).join(",");
  const shadingKey = [
    colorMode,
    phosphor,
    rampKey,
    ansi,
    tokens?.flat().join(","),
    JSON.stringify(grade ?? null),
  ].join("|");

  const draw = (context: AsciiGridDrawContext) => {
    const { frame, columns, rows, delta, metrics, time } = context;
    const aspect =
      (columns * metrics.width) / Math.max(1, rows * metrics.height);
    const flockKey = `${columns}x${rows}x${count}`;
    if (flockRef.current?.key !== flockKey) {
      flockRef.current = warmFlock(time, count, aspect, forces, flockKey);
    }
    const flock = flockRef.current;

    if (shadingRef.current?.key !== shadingKey) {
      shadingRef.current = createShading(
        { ansi, colorMode, phosphor, ramp },
        tokens,
        shadingKey
      );
    }
    const shading = shadingRef.current;

    const set = resolveCharset(charset, chars);
    const [gx, gy] = set.grid;
    const packed = set.kind === "braille" || set.kind === "quadrants";
    const { darkInk } = shading;
    const skyKey = `${columns}x${rows}x${gx}x${gy}x${horizon}x${darkInk}x${packed}`;
    if (skyRef.current?.key !== skyKey) {
      skyRef.current = createSky({
        aspect,
        columns,
        darkInk,
        gx,
        gy,
        horizon,
        key: skyKey,
        packed,
        rows,
      });
    }
    const sky = skyRef.current;

    if (delta > 0) {
      const dt = Math.min(delta, 0.05);
      const hunt = readHunt(flock, context, interactive);
      // Fixed steps keep the flock stable at any frame rate; a press
      // counts once, on the first of them.
      const steps = Math.min(3, Math.max(1, Math.round(dt / FIXED_STEP)));
      step(flock, dt / steps, forces, hunt);
      for (let i = 1; i < steps; i += 1) {
        step(flock, dt / steps, forces, hunt);
      }
    }

    render(sky, flock, packed, horizon === "reeds");
    mapTones(
      sky.field,
      columns,
      rows,
      {
        charset: set,
        colorMode: "palette",
        // Every charset gets blue noise: it breaks the sky gradient into
        // stipple instead of rows of one glyph.
        dither: dither ?? "blue-noise",
        edgeThreshold,
        grade,
        invert,
        threshold,
      },
      frame
    );
    colorCells(sky, frame, shading, grade);
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
