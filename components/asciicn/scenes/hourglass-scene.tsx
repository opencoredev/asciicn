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
  edgeChar,
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

/** What the caps and posts are made of. */
export type HourglassFinish = "walnut" | "brass" | "ebony";

export interface HourglassSceneProps extends AsciiSceneProps {
  /** Seconds for the top bulb to empty, 4 to 120. Default 20. */
  duration?: number;
  /** How full one bulb is, 0.15 to 0.85. Default 0.6. */
  fill?: number;
  /** Sand layer colours as `#rrggbb`, poured in order, up to 7. Default six warm desert tints. */
  sand?: readonly string[];
  /** Caps and posts. Default `"walnut"`. */
  finish?: HourglassFinish;
  /** How far the pointer tilts the glass, in degrees, 0 to 40. Default 18. */
  tilt?: number;
}

const DEFAULT_SAND = [
  "#f2d39a",
  "#e0a95c",
  "#c97c45",
  "#f6e7c8",
  "#d9b26f",
  "#b0653a",
] as const satisfies readonly string[];

const FINISHES = {
  brass: { dark: "#5e3f12", light: "#f3d27a", trim: "#fff2c6" },
  ebony: { dark: "#1b1612", light: "#76675a", trim: "#d9dee4" },
  walnut: { dark: "#3a2012", light: "#a96b3f", trim: "#e4b65f" },
} as const satisfies Record<
  HourglassFinish,
  { dark: string; light: string; trim: string }
>;

const GLASS = {
  lit: hexToRgb("#f1f8ff"),
  shade: hexToRgb("#6d8ca6"),
} as const;

const BACKDROP = "#0b0807";
const FALLBACK = hexToRgb("#d9a35a");
const DEFAULT_FX: PostFx = { bloom: 0.25 };
const PLACEHOLDER_PALETTE: readonly Rgb8[] = [[255, 255, 255]];

/**
 * The glass, in units of one bulb's length (neck to cap). The bulbs are
 * narrow at the neck, widest at `shoulder`, then round off into the caps.
 */
const SHAPE = {
  capHalfWidth: 0.74,
  capThickness: 0.1,
  /** Funnel slope: half-width gained per cell of length. */
  funnel: 0.72,
  neck: 0.034,
  postRadius: 0.04,
  postX: 0.665,
  radius: 0.56,
  shoulder: 0.52,
} as const;

/** Half the glass's length, caps included, in bulb lengths. */
const HALF_LENGTH = 1 + SHAPE.capThickness;
/** Share of the box the upright glass fills, per side. */
const FIT = 0.46;
/** Light comes from the upper left of the screen. */
const LIGHT = { x: -0.6, y: -0.8 } as const;
/** The slope of a resting pile: about 37 degrees. */
const REPOSE = 0.75;
/** The slope of the crater the top pile drains through. */
const CRATER = 0.5;

const MIN_BULB = 14;
const MAX_BULB = 120;
/** Simulation steps per second, per cell of bulb length, so sand falls at the same pace on any grid. */
const STEPS_PER_CELL = 1.8;
const MAX_STEPS = 8;
const FLIP_SECONDS = 2.4;
/** Share of the sand already through the neck on the first frame. */
const START_PROGRESS = 0.35;
const SETTLE_SECONDS = 1.1;

/** A numeric read that treats a missing index as 0. */
const read = (data: ArrayLike<number>, index: number): number =>
  data[index] ?? 0;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// --- Colour: scene colours through the active colour mode -----------------

interface SceneInk {
  /** A scene colour at a brightness (0 to 1), in the active colour mode. */
  readonly tint: (rgb: Rgb8, level?: number) => Rgb8;
}

const mix = (from: Rgb8, to: Rgb8, t: number): Rgb8 => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
];

const scale = (rgb: Rgb8, t: number): Rgb8 => [
  rgb[0] * t,
  rgb[1] * t,
  rgb[2] * t,
];

const brightness = (rgb: Rgb8) => Math.max(rgb[0], rgb[1], rgb[2]) / 255;

const createInk = (
  look: Pick<AsciiSceneProps, "colorMode" | "ramp" | "ansi" | "grade">,
  ink: Rgb8,
  paper: Rgb8
): SceneInk => {
  const { colorMode = "truecolor", grade } = look;
  if (colorMode === "duotone") {
    const ramp = look.ramp ?? "sodium";
    const stops = (typeof ramp === "string" ? RAMPS[ramp] : ramp).map(hexToRgb);
    return {
      tint: (rgb, level = 1) =>
        sampleRamp(stops, 0.2 + 0.8 * brightness(rgb) * level),
    };
  }
  if (colorMode === "ansi16") {
    const table = ANSI16[look.ansi ?? "vga"];
    return {
      tint: (rgb, level = 1) => {
        const graded = gradeRgb(scale(rgb, level), grade);
        return table[nearestIndex(graded, table)] ?? graded;
      },
    };
  }
  if (colorMode === "mono" || colorMode === "palette") {
    return {
      tint: (rgb, level = 1) =>
        mix(paper, ink, 0.25 + 0.75 * brightness(rgb) * level),
    };
  }
  return {
    tint: (rgb, level = 1) => gradeRgb(scale(rgb, level), grade),
  };
};

/** Ink and paper for a look: phosphor, ramp, theme tokens or the backdrop. */
const surfaceColors = (
  look: Pick<AsciiSceneProps, "colorMode" | "phosphor" | "ramp" | "background">
): { ink: string; paper: string } => {
  const { colorMode = "truecolor", phosphor, background = "paper" } = look;
  const ink =
    colorMode === "mono" && phosphor ? PHOSPHORS[phosphor].ink : "--ascii-ink";
  let paper: string = BACKDROP;
  if (colorMode === "mono") {
    paper = phosphor ? PHOSPHORS[phosphor].paper : "--ascii-paper";
  } else if (colorMode === "palette") {
    paper = "--ascii-paper";
  } else if (colorMode === "duotone") {
    const ramp = look.ramp ?? "sodium";
    paper = (typeof ramp === "string" ? RAMPS[ramp][0] : ramp[0]) ?? BACKDROP;
  }
  return { ink, paper: background === "transparent" ? "transparent" : paper };
};

const toBytes = (rgba: readonly number[] | undefined, fallback: Rgb8): Rgb8 =>
  rgba
    ? [read(rgba, 0) * 255, read(rgba, 1) * 255, read(rgba, 2) * 255]
    : fallback;

/**
 * The colour step for a look: a phosphor's ink and glass in mono, else the
 * theme's `--ascii-ink` and `--ascii-paper` (read once mounted).
 */
const sceneInk = (
  look: Pick<
    AsciiSceneProps,
    "colorMode" | "phosphor" | "ramp" | "ansi" | "grade"
  >,
  tokens: readonly (readonly number[])[] | null
): SceneInk => {
  const glass =
    look.colorMode === "mono" && look.phosphor
      ? PHOSPHORS[look.phosphor]
      : null;
  const ink = glass
    ? hexToRgb(glass.ink)
    : toBytes(tokens?.[0], [236, 228, 214]);
  const paper = glass
    ? hexToRgb(glass.paper)
    : toBytes(tokens?.[1], hexToRgb(BACKDROP));
  return createInk(look, ink, paper);
};

// --- The sand --------------------------------------------------------------------

/**
 * Falling sand on a square grid in the glass's own frame, so the sand turns
 * with the glass for free: only gravity's direction changes. Cells hold 0
 * for air, 255 for glass and anything else for a grain: its layer times 32
 * plus a per-grain jitter, plus one.
 */
interface Sand {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  /** One bulb's length in cells, neck to cap. */
  readonly bulb: number;
  /** The neck cell: the column on the axis and the waist row. */
  readonly cx: number;
  readonly cy: number;
  readonly cells: Uint8Array;
  /** Grain speed in eighths of a cell per step; grains speed up in free fall. */
  readonly speed: Uint8Array;
  /** The step a grain last moved in, so it moves once per step. */
  readonly stamp: Uint8Array;
  /** Index offsets to the 8 neighbours, counter-clockwise from +x (y down). */
  readonly offsets: Int32Array;
  /**
   * The first and last open cell of every row and column, so a step only
   * visits the inside of the glass. Rows with none have first > last.
   */
  readonly rowSpans: Int16Array;
  readonly columnSpans: Int16Array;
  /** The inner half-width every quarter cell from the neck, and its slope. */
  readonly profile: Float32Array;
  readonly slope: Float32Array;
  readonly total: number;
  /** Grains above the waist (rows before `cy`) and below it. */
  above: number;
  below: number;
  /** Grains allowed through the neck right now; refilled every step. */
  tokens: number;
  marker: number;
}

const DIRECTION_X = [1, 1, 0, -1, -1, -1, 0, 1] as const;
const DIRECTION_Y = [0, 1, 1, 1, 0, -1, -1, -1] as const;
const LAYER_SIZE = 32;
const MAX_LAYERS = 7;
const WALL = 255;
const REST_SPEED = 8;
const TOP_SPEED = 32;

/**
 * The inner half-width at `u` (0 at the neck, 1 at the cap), in cells: a
 * straight funnel out of the neck, rounded into an oval bulb. The funnel
 * is steeper than the angle of repose, so every grain drains.
 */
const halfWidthAt = (u: number, bulb: number) => {
  const neck = Math.max(1.5, SHAPE.neck * bulb);
  const funnel = neck + SHAPE.funnel * u * bulb;
  const k = (u - SHAPE.shoulder) / (1 - SHAPE.shoulder + 0.12);
  const oval =
    SHAPE.radius * bulb * (k > 0 ? Math.sqrt(Math.max(0, 1 - k * k)) : 1);
  // A soft minimum rounds the corner where the funnel meets the oval.
  const soft = 0.14 * bulb;
  const h = Math.max(0, soft - Math.abs(funnel - oval)) / soft;
  return Math.max(neck, Math.min(funnel, oval) - (h * h * soft) / 4);
};

/**
 * A fresh glass with `progress` of its sand already through the neck. The
 * top pile gets a crater over the neck and the bottom one a cone, both at
 * the angle of repose, so the first frame looks mid-pour. Layers are
 * coloured in pouring order: the bottom's first, then the top's from the
 * neck outward.
 */
const createSand = (
  bulb: number,
  fill: number,
  progress: number,
  topIsAbove: boolean,
  layers: number,
  key: string
): Sand => {
  const radius = Math.ceil(SHAPE.radius * bulb);
  const width = radius * 2 + 5;
  const height = bulb * 2 + 3;
  const cx = (width - 1) / 2;
  const cy = bulb + 1;
  const size = width * height;
  const cells = new Uint8Array(size).fill(WALL);
  const quarters = bulb * 4 + 2;
  const profile = new Float32Array(quarters);
  const slope = new Float32Array(quarters);
  for (let i = 0; i < quarters; i += 1) {
    profile[i] = halfWidthAt(Math.min(1, i / 4 / bulb), bulb);
  }
  for (let i = 0; i < quarters; i += 1) {
    const before = read(profile, Math.max(0, i - 1));
    const after = read(profile, Math.min(quarters - 1, i + 1));
    slope[i] = (after - before) * 2;
  }

  let perBulb = 0;
  for (let row = 1; row < height - 1; row += 1) {
    const axial = Math.abs(row - cy);
    if (axial >= bulb) {
      continue;
    }
    const half = read(profile, axial * 4);
    for (let column = 1; column < width - 1; column += 1) {
      if (Math.abs(column - cx) <= half - 0.5) {
        cells[row * width + column] = 0;
        if (row < cy) {
          perBulb += 1;
        }
      }
    }
  }

  const total = Math.round(perBulb * clamp(fill, 0.15, 0.85));
  const bottomCount = Math.round(total * clamp(progress, 0, 1));
  const topCount = total - bottomCount;

  // Rank cells by fill order in quarter-cell bins, so each pile takes
  // exactly its share and layers follow the order sand was poured.
  const bins = Math.ceil((bulb + REPOSE * radius + 2) * 8);
  const offset = Math.ceil((REPOSE * radius + 1) * 4);
  const fillPile = (top: boolean, count: number, startRank: number) => {
    const histogram = new Int32Array(bins);
    const used = new Int32Array(bins);
    const priority = (row: number, column: number) => {
      const axial = Math.abs(row - cy);
      const across = Math.abs(column - cx);
      // The crater above is shallower than the cone below, as in a real glass.
      const value = top
        ? axial - across * CRATER
        : bulb - axial + across * REPOSE;
      return clamp(Math.floor(value * 4) + offset, 0, bins - 1);
    };
    const onSide = (row: number) => row < cy === (top === topIsAbove);
    for (let row = 1; row < height - 1; row += 1) {
      for (let column = 1; column < width - 1; column += 1) {
        if (cells[row * width + column] === 0 && onSide(row)) {
          const bin = priority(row, column);
          histogram[bin] = read(histogram, bin) + 1;
        }
      }
    }
    let running = 0;
    for (let bin = 0; bin < bins; bin += 1) {
      const inBin = read(histogram, bin);
      histogram[bin] = running;
      running += inBin;
    }
    for (let row = 1; row < height - 1; row += 1) {
      for (let column = 1; column < width - 1; column += 1) {
        const index = row * width + column;
        if (cells[index] !== 0 || !onSide(row)) {
          continue;
        }
        const bin = priority(row, column);
        const rank = read(histogram, bin) + read(used, bin);
        if (rank >= count) {
          continue;
        }
        used[bin] = read(used, bin) + 1;
        const poured = (startRank + rank) / Math.max(1, total);
        const layer = Math.floor(poured * layers * 2) % layers;
        const jitter = Math.floor(Math.random() * LAYER_SIZE);
        cells[index] = 1 + layer * LAYER_SIZE + jitter;
      }
    }
  };
  fillPile(false, bottomCount, 0);
  fillPile(true, topCount, bottomCount);

  let above = 0;
  for (let index = 0; index < cy * width; index += 1) {
    const value = read(cells, index);
    if (value > 0 && value < WALL) {
      above += 1;
    }
  }

  const rowSpans = new Int16Array(height * 2);
  const columnSpans = new Int16Array(width * 2);
  for (let row = 0; row < height; row += 1) {
    rowSpans[row * 2] = width;
    rowSpans[row * 2 + 1] = -1;
  }
  for (let column = 0; column < width; column += 1) {
    columnSpans[column * 2] = height;
    columnSpans[column * 2 + 1] = -1;
  }
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (cells[row * width + column] !== WALL) {
        rowSpans[row * 2] = Math.min(read(rowSpans, row * 2), column);
        rowSpans[row * 2 + 1] = Math.max(read(rowSpans, row * 2 + 1), column);
        columnSpans[column * 2] = Math.min(read(columnSpans, column * 2), row);
        columnSpans[column * 2 + 1] = Math.max(
          read(columnSpans, column * 2 + 1),
          row
        );
      }
    }
  }

  const offsets = new Int32Array(8);
  for (let d = 0; d < 8; d += 1) {
    offsets[d] = read(DIRECTION_Y, d) * width + read(DIRECTION_X, d);
  }

  return {
    above,
    below: total - above,
    bulb,
    cells,
    columnSpans,
    cx,
    cy,
    height,
    key,
    marker: 1,
    offsets,
    profile,
    rowSpans,
    slope,
    speed: new Uint8Array(size).fill(REST_SPEED),
    stamp: new Uint8Array(size),
    tokens: 0,
    total,
    width,
  };
};

/**
 * Let a grain cross the waist if the neck has a token for it. Moves that
 * stay on one side always pass.
 */
const passes = (sand: Sand, from: number, to: number) => {
  const limit = sand.cy * sand.width;
  const fromAbove = from < limit;
  if (fromAbove === to < limit) {
    return true;
  }
  if (sand.tokens < 1) {
    return false;
  }
  sand.tokens -= 1;
  if (fromAbove) {
    sand.above -= 1;
    sand.below += 1;
  } else {
    sand.above += 1;
    sand.below -= 1;
  }
  return true;
};

const place = (sand: Sand, from: number, to: number, speed: number) => {
  const { cells } = sand;
  cells[to] = read(cells, from);
  cells[from] = 0;
  sand.speed[to] = speed;
  sand.stamp[to] = sand.marker;
};

/** A direction index, 0 to 7, for any whole number. */
const wrap8 = (d: number) => ((d % 8) + 8) % 8;

const isAir = (cells: Uint8Array, index: number) => cells[index] === 0;

/**
 * One grain's move. Gravity points between two of the eight neighbours;
 * the grain picks one at random, weighted by how close it is, so a tilt of
 * a few degrees still drifts the sand. A blocked grain tries the two
 * diagonals, then sometimes slides sideways to an edge, which brings the
 * pile down to the angle of repose.
 */
/** Move a grain to `to` if it is air and the neck lets it through. */
const tryMove = (sand: Sand, from: number, to: number) => {
  if (isAir(sand.cells, to) && passes(sand, from, to)) {
    place(sand, from, to, REST_SPEED);
    return true;
  }
  return false;
};

/** Fall along `fall`, a cell or more per step as the grain picks up speed. */
const fallFrom = (sand: Sand, index: number, fall: number) => {
  const { cells } = sand;
  const speed = read(sand.speed, index);
  const reach =
    Math.floor(speed / 8) + (Math.random() < (speed % 8) / 8 ? 1 : 0);
  let at = index + fall;
  for (let k = 1; k < reach; k += 1) {
    const next = at + fall;
    if (!isAir(cells, next) || !passes(sand, at, next)) {
      break;
    }
    at = next;
  }
  place(sand, index, at, Math.min(TOP_SPEED, speed + 2));
};

const moveGrain = (
  sand: Sand,
  index: number,
  low: number,
  between: number,
  agitation: number
) => {
  const { cells, offsets } = sand;
  if (
    agitation > 0 &&
    Math.random() < agitation &&
    tryMove(sand, index, index + read(offsets, Math.floor(Math.random() * 8)))
  ) {
    return;
  }
  const d = wrap8(low + (Math.random() < between ? 1 : 0));
  const fall = read(offsets, d);
  if (isAir(cells, index + fall) && passes(sand, index, index + fall)) {
    fallFrom(sand, index, fall);
    return;
  }
  const turn = Math.random() < 0.5 ? 1 : -1;
  if (
    tryMove(sand, index, index + read(offsets, wrap8(d + turn))) ||
    tryMove(sand, index, index + read(offsets, wrap8(d - turn)))
  ) {
    return;
  }
  const edge = index + read(offsets, wrap8(d + turn * 2));
  if (
    Math.random() < 0.3 &&
    isAir(cells, edge + fall) &&
    tryMove(sand, index, edge)
  ) {
    return;
  }
  sand.speed[index] = REST_SPEED;
};

/**
 * One step of the automaton under gravity (gx, gy) in the glass's frame.
 * Cells are visited from the downhill end so a falling column moves as
 * one, with the cross direction flipped at random to keep piles even.
 */
const step = (
  sand: Sand,
  gx: number,
  gy: number,
  rate: number,
  agitation: number
) => {
  const { width, height, cells, stamp } = sand;
  sand.tokens = Math.min(sand.tokens + rate, 2 + rate);
  sand.marker = (sand.marker % 250) + 1;
  const { marker } = sand;
  const octant = Math.atan2(gy, gx) / (Math.PI / 4);
  const low = wrap8(Math.floor(octant));
  const between = octant - Math.floor(octant);
  const visit = (index: number) => {
    const value = read(cells, index);
    if (value !== 0 && value !== WALL && stamp[index] !== marker) {
      moveGrain(sand, index, low, between, agitation);
    }
  };
  if (Math.abs(gy) >= Math.abs(gx)) {
    const down = gy > 0;
    for (let k = 1; k < height - 1; k += 1) {
      const row = down ? height - 1 - k : k;
      const first = read(sand.rowSpans, row * 2);
      const last = read(sand.rowSpans, row * 2 + 1);
      const flip = Math.random() < 0.5;
      for (let c = first; c <= last; c += 1) {
        visit(row * width + (flip ? first + last - c : c));
      }
    }
  } else {
    const right = gx > 0;
    for (let k = 1; k < width - 1; k += 1) {
      const column = right ? width - 1 - k : k;
      const first = read(sand.columnSpans, column * 2);
      const last = read(sand.columnSpans, column * 2 + 1);
      const flip = Math.random() < 0.5;
      for (let r = first; r <= last; r += 1) {
        visit((flip ? first + last - r : r) * width + column);
      }
    }
  }
};

// --- Turning, tilting and shaking ------------------------------------------------

type TurnPhase = "pour" | "settle" | "flip";

/** The glass's motion. It outlives the sand, so a resize keeps the angle. */
interface Turn {
  /** The glass's angle without tilt or shake, in radians. */
  base: number;
  from: number;
  phase: TurnPhase;
  /** Seconds in the current phase. */
  clock: number;
  /** The pointer's tilt, eased, in radians. */
  tilt: number;
  /** Seconds since the last press. */
  shake: number;
  wasDown: boolean;
  /** Simulation steps owed to the clock. */
  owed: number;
}

const createTurn = (): Turn => ({
  base: 0,
  clock: 0,
  from: 0,
  owed: 0,
  phase: "pour",
  shake: Number.POSITIVE_INFINITY,
  tilt: 0,
  wasDown: false,
});

/** Starts and ends softly, like a hand turning it over. */
const smoother = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

const shakeAngle = (seconds: number) =>
  seconds < 1.2
    ? 0.11 * Math.exp(-4.2 * seconds) * Math.sin(seconds * Math.PI * 2 * 6.5)
    : 0;

const glassAngle = (turn: Turn) =>
  turn.base + turn.tilt + shakeAngle(turn.shake);

/** Advance the flip cycle: pour until the top is empty, settle, then turn over. */
const advanceTurn = (turn: Turn, sand: Sand, dt: number, duration: number) => {
  turn.clock += dt;
  if (turn.phase === "pour") {
    const topIsAbove = Math.cos(turn.base) > 0;
    const top = topIsAbove ? sand.above : sand.below;
    if (top === 0 || turn.clock > duration * 3 + 10) {
      turn.phase = "settle";
      turn.clock = 0;
    }
  } else if (turn.phase === "settle") {
    if (turn.clock >= SETTLE_SECONDS) {
      turn.phase = "flip";
      turn.from = turn.base;
      turn.clock = 0;
    }
  } else {
    const progress = turn.clock / FLIP_SECONDS;
    turn.base = turn.from + Math.PI * smoother(progress);
    if (progress >= 1) {
      turn.base = (turn.from + Math.PI) % (Math.PI * 2);
      turn.phase = "pour";
      turn.clock = 0;
    }
  }
};

// --- Drawing --------------------------------------------------------------------

interface Canvas {
  readonly key: string;
  readonly field: ToneField;
  readonly rgb: Uint8ClampedArray;
  /** Per sample: how much of its tone is glass wall, and the wall's screen normal. */
  readonly wall: Float32Array;
  /** Per sample: how much of its tone is the metal ring at a cap. */
  readonly ring: Float32Array;
  readonly normals: Float32Array;
  readonly gx: number;
  readonly gy: number;
  /** Lookups per sample across and down, so each lands on about one cell. */
  readonly nx: number;
  readonly ny: number;
}

const createCanvas = (
  columns: number,
  rows: number,
  gx: number,
  gy: number,
  nx: number,
  ny: number,
  key: string
): Canvas => {
  const field = createToneField(columns, rows, {
    glyphs: [" ", "#"],
    grid: [gx, gy],
    id: "hourglass",
    kind: "ramp",
    label: "hourglass",
  });
  return {
    field,
    gx,
    gy,
    key,
    normals: new Float32Array(field.width * field.height * 2),
    nx,
    ny,
    rgb: new Uint8ClampedArray(field.width * field.height * 3),
    ring: new Float32Array(field.width * field.height),
    wall: new Float32Array(field.width * field.height),
  };
};

/** Tone and colour lookups for grains, wood and glass, rebuilt when a colour knob changes. */
interface Palette {
  readonly key: string;
  /** Per cell value: grain tone and colour. */
  readonly grainTone: Float32Array;
  readonly grainRgb: Uint8ClampedArray;
  readonly wood: readonly [Rgb8, Rgb8];
  readonly trim: Rgb8;
}

const createPalette = (
  sand: readonly string[],
  finish: HourglassFinish,
  packed: boolean,
  key: string
): Palette => {
  const tints = (sand.length > 0 ? sand : DEFAULT_SAND)
    .slice(0, MAX_LAYERS)
    .map(hexToRgb);
  const grainTone = new Float32Array(256);
  const grainRgb = new Uint8ClampedArray(256 * 3);
  for (let value = 1; value < WALL; value += 1) {
    const layer = Math.floor((value - 1) / LAYER_SIZE) % tints.length;
    const jitter = ((value - 1) % LAYER_SIZE) / (LAYER_SIZE - 1);
    const tint = tints[layer] ?? FALLBACK;
    // Dot charsets light every grain; ramps vary the glyph for texture.
    grainTone[value] = packed ? 1 : 0.7 + 0.18 * jitter;
    const shade = 0.82 + 0.3 * jitter;
    grainRgb.set(scale(tint, shade), value * 3);
  }
  const { dark, light, trim } = FINISHES[finish];
  return {
    grainRgb,
    grainTone,
    key,
    trim: hexToRgb(trim),
    wood: [hexToRgb(dark), hexToRgb(light)],
  };
};

/** Where the glass sits on screen this frame. */
interface View {
  /** Glass centre in CSS px. */
  readonly x: number;
  readonly y: number;
  readonly cos: number;
  readonly sin: number;
  /** Simulation cells per CSS px. */
  readonly inverse: number;
  /** Glass wall thickness in cells. */
  readonly wall: number;
  /** Which side of the glass catches the highlight (in its frame), and how strongly. */
  readonly band: number;
  /** Tone of that highlight: dot charsets only, where it reads as a sparse glint. */
  readonly sheen: number;
}

/** Write `from` mixed towards `to` by `t` into `out`. */
const mixInto = (out: Float32Array, from: Rgb8, to: Rgb8, t: number) => {
  const [fr, fg, fb] = from;
  const [tr, tg, tb] = to;
  out[0] = fr + (tr - fr) * t;
  out[1] = fg + (tg - fg) * t;
  out[2] = fb + (tb - fb) * t;
};

/** Inside the glass: a grain, the faint reflection, or air. */
const shadeInside = (
  sand: Sand,
  palette: Palette,
  view: View,
  bx: number,
  by: number,
  half: number,
  out: Float32Array
): number => {
  const index =
    (Math.round(by) + sand.cy) * sand.width + Math.round(bx) + sand.cx;
  const value = read(sand.cells, index);
  if (value > 0 && value < WALL) {
    // Rounder towards the walls, like sand in a curved glass.
    const edge = Math.abs(bx) / half;
    const light = 1 - 0.3 * edge * edge;
    out[0] = read(palette.grainRgb, value * 3) * light;
    out[1] = read(palette.grainRgb, value * 3 + 1) * light;
    out[2] = read(palette.grainRgb, value * 3 + 2) * light;
    // Dot charsets keep every grain at full tone so each one lights its dot.
    const tone = read(palette.grainTone, value);
    return tone >= 1 ? 1 : tone * (0.86 + 0.14 * light);
  }
  // A faint reflection running down the lit side of the glass.
  const side = (bx / half) * Math.sign(view.band);
  const along = Math.abs(by) / sand.bulb;
  if (side > 0.55 && side < 0.68 && along > 0.5 && along < 0.86) {
    mixInto(out, GLASS.lit, GLASS.lit, 0);
    return view.sheen * Math.abs(view.band);
  }
  return 0;
};

/** The glass wall, rim-lit in screen space so the highlight stays put as it turns. */
const shadeWall = (
  view: View,
  bx: number,
  by: number,
  tilt: number,
  norm: number,
  out: Float32Array
): number => {
  const nx = Math.sign(bx) / norm;
  const ny = (-Math.sign(by) * tilt) / norm;
  const sx = nx * view.cos - ny * view.sin;
  const sy = nx * view.sin + ny * view.cos;
  const lit = sx * LIGHT.x + sy * LIGHT.y;
  const front = Math.max(0, lit);
  const back = Math.max(0, -lit) ** 3;
  mixInto(
    out,
    GLASS.shade,
    GLASS.lit,
    Math.min(1, 0.25 + 0.75 * front + 0.35 * back)
  );
  out[3] = 1;
  out[4] = sx;
  out[5] = sy;
  return 0.58 + 0.42 * front + 0.2 * back;
};

/** The turned posts, with a bead every tenth of the length and a wider foot. */
const shadePost = (
  palette: Palette,
  bulb: number,
  across: number,
  axial: number,
  by: number,
  out: Float32Array
): number => {
  const reach = across - SHAPE.postX * bulb;
  if (Math.abs(reach) > SHAPE.postRadius * bulb * 1.5) {
    return 0;
  }
  const u = axial / bulb;
  const bead = Math.cos(u * Math.PI * 5) ** 2;
  const foot = Math.max(0, (u - 0.86) / 0.14);
  const radius =
    SHAPE.postRadius * bulb * (0.72 + 0.3 * bead + 0.45 * foot * foot);
  const offset = reach / radius;
  if (Math.abs(offset) >= 1) {
    return 0;
  }
  const round = Math.sqrt(1 - offset * offset);
  const grain = 0.06 * Math.sin(by * 1.3 + offset * 2);
  const shade = clamp(0.3 + 0.62 * round + grain, 0, 1);
  mixInto(out, palette.wood[0], palette.wood[1], shade);
  return 0.58 + 0.38 * shade;
};

/** A cap: a metal ring where the glass seats, then wood with rounded corners. */
const shadeCap = (
  palette: Palette,
  view: View,
  bulb: number,
  bx: number,
  by: number,
  axial: number,
  out: Float32Array
): number => {
  const thickness = SHAPE.capThickness * bulb;
  const u = (axial - bulb) / thickness;
  if (u >= 1) {
    return 0;
  }
  const corner = Math.max(0, (u - 0.5) / 0.5);
  const reach = SHAPE.capHalfWidth * bulb - thickness * 0.7 * corner * corner;
  if (Math.abs(bx) >= reach) {
    return 0;
  }
  const t = bx / reach;
  const round = Math.sqrt(Math.max(0, 1 - t * t));
  if (u < 0.24) {
    // The ring runs across the glass's axis.
    mixInto(out, palette.trim, palette.trim, 0);
    const shine = clamp(0.45 + 0.55 * round, 0, 1);
    out[0] = read(out, 0) * shine;
    out[1] = read(out, 1) * shine;
    out[2] = read(out, 2) * shine;
    out[3] = 2;
    out[4] = -view.sin;
    out[5] = view.cos;
    return 0.6 + 0.38 * round;
  }
  const grain = 0.08 * Math.sin(bx * 0.5 + 2.2 * Math.sin(by * 0.8));
  const shade = clamp(0.28 + 0.6 * round + grain - 0.15 * corner, 0, 1);
  mixInto(out, palette.wood[0], palette.wood[1], shade);
  // Dense glyphs, so the cap reads as solid wood with colour for shading.
  return 0.64 + 0.34 * shade;
};

/** The shade at one point of the glass's frame: tone, then RGB in `out`. */
const shadePoint = (
  sand: Sand,
  palette: Palette,
  view: View,
  bx: number,
  by: number,
  out: Float32Array
): number => {
  const { bulb } = sand;
  const axial = Math.abs(by);
  const across = Math.abs(bx);
  // Most of the box is empty: skip it before any shading maths.
  if (across >= SHAPE.capHalfWidth * bulb || axial >= HALF_LENGTH * bulb) {
    return 0;
  }
  if (axial >= bulb) {
    return shadeCap(palette, view, bulb, bx, by, axial, out);
  }
  const quarter = Math.min(sand.profile.length - 1, Math.floor(axial * 4));
  const half = read(sand.profile, quarter);
  if (across < half) {
    return shadeInside(sand, palette, view, bx, by, half, out);
  }
  const tilt = read(sand.slope, quarter);
  const norm = Math.sqrt(1 + tilt * tilt);
  if ((across - half) / norm < view.wall) {
    return shadeWall(view, bx, by, tilt, norm, out);
  }
  return shadePost(palette, bulb, across, axial, by, out);
};

/** RGB, then a wall flag and the wall's screen normal. */
const scratch = new Float32Array(6);

/** A sample's size in CSS px. */
interface Sampling {
  readonly width: number;
  readonly height: number;
}

/**
 * Shade one sample. Its lookups are turned back into the glass's frame and
 * read there, one per simulation cell it covers, so tall ramp samples
 * average the two grains they span.
 */
const shadeSample = (
  canvas: Canvas,
  sand: Sand,
  palette: Palette,
  view: View,
  sampling: Sampling,
  x: number,
  y: number
) => {
  const { field, rgb, nx, ny, wall, ring, normals } = canvas;
  const { cos, sin, inverse } = view;
  const stepX = sampling.width / nx;
  const stepY = sampling.height / ny;
  let tone = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let glass = 0;
  let metal = 0;
  let normalX = 0;
  let normalY = 0;
  for (let sy = 0; sy < ny; sy += 1) {
    const dy = y * sampling.height + (sy + 0.5) * stepY - view.y;
    for (let sx = 0; sx < nx; sx += 1) {
      const dx = x * sampling.width + (sx + 0.5) * stepX - view.x;
      scratch[3] = 0;
      const value = shadePoint(
        sand,
        palette,
        view,
        (dx * cos + dy * sin) * inverse,
        (dy * cos - dx * sin) * inverse,
        scratch
      );
      if (value > 0) {
        const kind = read(scratch, 3);
        glass += kind === 1 ? value : 0;
        metal += kind === 2 ? value : 0;
        normalX += kind > 0 ? read(scratch, 4) : 0;
        normalY += kind > 0 ? read(scratch, 5) : 0;
        tone += value;
        r += read(scratch, 0) * value;
        g += read(scratch, 1) * value;
        b += read(scratch, 2) * value;
      }
    }
  }
  const index = y * field.width + x;
  field.tones[index] = tone / (nx * ny);
  const inked = tone > 0 ? 1 / tone : 0;
  wall[index] = glass * inked;
  ring[index] = metal * inked;
  normals[index * 2] = normalX;
  normals[index * 2 + 1] = normalY;
  rgb[index * 3] = r * inked;
  rgb[index * 3 + 1] = g * inked;
  rgb[index * 3 + 2] = b * inked;
};

/**
 * The span of offsets `d` where `|d * a + c| < limit`, intersected into
 * `span`. With `a` near 0 it is everything or nothing.
 */
const clipSpan = (span: Float64Array, a: number, c: number, limit: number) => {
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(c) >= limit) {
      span[1] = span[0] ?? 0;
    }
    return;
  }
  const one = (-limit - c) / a;
  const two = (limit - c) / a;
  span[0] = Math.max(read(span, 0), Math.min(one, two));
  span[1] = Math.min(read(span, 1), Math.max(one, two));
};

const span = new Float64Array(2);

/**
 * Shade every sample. Each row only shades the stretch the turned glass
 * can cover, the rest is cleared, so most of a wide box costs nothing.
 */
const render = (
  canvas: Canvas,
  sand: Sand,
  palette: Palette,
  view: View,
  sampling: Sampling
) => {
  const { field } = canvas;
  const { cos, sin, inverse } = view;
  const across = (SHAPE.capHalfWidth * sand.bulb) / inverse;
  const along = (HALF_LENGTH * sand.bulb) / inverse;
  // A sample's lookups reach up to one sample from its row's centre line.
  const margin = Math.hypot(sampling.width, sampling.height);
  for (let y = 0; y < field.height; y += 1) {
    const dy = (y + 0.5) * sampling.height - view.y;
    span[0] = -view.x;
    span[1] = field.width * sampling.width - view.x;
    clipSpan(span, cos, dy * sin, across + margin);
    clipSpan(span, -sin, dy * cos, along + margin);
    const first = Math.max(
      0,
      Math.floor((view.x + read(span, 0)) / sampling.width) - 1
    );
    const last = Math.min(
      field.width,
      Math.ceil((view.x + read(span, 1)) / sampling.width) + 1
    );
    const row = y * field.width;
    if (last <= first) {
      field.tones.fill(0, row, row + field.width);
      continue;
    }
    field.tones.fill(0, row, row + first);
    field.tones.fill(0, row + last, row + field.width);
    for (let x = first; x < last; x += 1) {
      shadeSample(canvas, sand, palette, view, sampling, x, y);
    }
  }
};

/**
 * Ramp charsets draw the glass wall as line glyphs along it, so the outline
 * reads as glass, not as letters. The normal is scaled to cell units first,
 * because cells are about twice as tall as they are wide.
 */
const outlineGlass = (
  canvas: Canvas,
  frame: MutableFrame,
  cellWidth: number,
  cellHeight: number
) => {
  const { field, wall, ring, normals } = canvas;
  const { glyphs } = frame;
  for (let index = 0; index < glyphs.length; index += 1) {
    const isRing = read(ring, index) > 0.5;
    if ((isRing || read(wall, index) > 0.5) && read(field.tones, index) > 0.2) {
      const line = edgeChar(
        read(normals, index * 2) * cellWidth,
        read(normals, index * 2 + 1) * cellHeight
      );
      // The ring doubles up: = upright, a thick bar on its side.
      glyphs[index] = isRing && line === "-" ? "=" : line;
    }
  }
};

/** Colour every inked cell from its samples, weighted by tone. */
const colorCells = (canvas: Canvas, frame: MutableFrame, ink: SceneInk) => {
  const { field, rgb, gx, gy } = canvas;
  const { colors, glyphs, columns, rows } = frame;
  if (!colors) {
    return;
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cell = row * columns + column;
      if (glyphs[cell] === " ") {
        continue;
      }
      let r = 0;
      let g = 0;
      let b = 0;
      let weight = 0;
      let peak = 0;
      for (let dy = 0; dy < gy; dy += 1) {
        const base = (row * gy + dy) * field.width + column * gx;
        for (let dx = 0; dx < gx; dx += 1) {
          const tone = read(field.tones, base + dx);
          if (tone > 0) {
            r += read(rgb, (base + dx) * 3) * tone;
            g += read(rgb, (base + dx) * 3 + 1) * tone;
            b += read(rgb, (base + dx) * 3 + 2) * tone;
            weight += tone;
            peak = Math.max(peak, tone);
          }
        }
      }
      const source: Rgb8 =
        weight > 0 ? [r / weight, g / weight, b / weight] : FALLBACK;
      const [cr, cg, cb] = ink.tint(
        source,
        weight > 0 ? 0.6 + 0.4 * peak : 0.6
      );
      colors[cell * 4] = cr;
      colors[cell * 4 + 1] = cg;
      colors[cell * 4 + 2] = cb;
      colors[cell * 4 + 3] = 255;
    }
  }
};

/** Bulb length in cells for a box, so one cell is about one lookup. */
const bulbCells = (boxWidth: number, boxHeight: number, lookup: number) =>
  clamp(
    Math.floor(
      Math.min(
        (FIT * boxHeight) / (HALF_LENGTH * lookup),
        (FIT * boxWidth) / (SHAPE.capHalfWidth * lookup)
      )
    ),
    MIN_BULB,
    MAX_BULB
  );

/** CSS px per cell: upright fills the box; turned sideways it shrinks to fit. */
const viewScale = (
  bulb: number,
  angle: number,
  boxWidth: number,
  boxHeight: number
) => {
  const half = SHAPE.capHalfWidth * bulb;
  const length = HALF_LENGTH * bulb;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const upright = Math.min((FIT * boxHeight) / length, (FIT * boxWidth) / half);
  const turned = Math.min(
    ((FIT + 0.02) * boxWidth) / (cos * half + sin * length),
    ((FIT + 0.02) * boxHeight) / (sin * half + cos * length)
  );
  return Math.min(upright, turned);
};

/** What a refill needs to build its glass. */
interface Refill {
  readonly bulb: number;
  readonly fill: number;
  readonly layers: number;
  readonly pour: number;
  readonly key: string;
}

/**
 * A new glass for a new grid size or fill. It keeps how far the pour had
 * got, so a resize or a knob change carries on, and runs a moment ahead so
 * the stream is already falling.
 */
const refill = (previous: Sand | null, turn: Turn, next: Refill): Sand => {
  const angle = glassAngle(turn);
  const topIsAbove = Math.cos(angle) >= 0;
  const progress = previous
    ? (topIsAbove ? previous.below : previous.above) /
      Math.max(1, previous.total)
    : START_PROGRESS;
  const fresh = createSand(
    next.bulb,
    next.fill,
    progress,
    topIsAbove,
    next.layers,
    next.key
  );
  const rate = fresh.total / (next.pour * STEPS_PER_CELL * next.bulb);
  for (let warm = 0; warm < next.bulb * 0.9; warm += 1) {
    step(fresh, Math.sin(angle), Math.cos(angle), rate, 0);
  }
  if (turn.phase !== "flip") {
    turn.phase = "pour";
    turn.clock = 0;
  }
  return fresh;
};

/** One frame of motion: pointer tilt and shake, the flip cycle, then the sand. */
const tick = (
  turn: Turn,
  glass: Sand,
  { pointer, columns, delta }: AsciiGridDrawContext,
  knobs: { interactive: boolean; pour: number; reach: number }
) => {
  const dt = Math.min(delta, 0.1);
  const active = knobs.interactive && pointer.inside;
  const lean = active
    ? clamp(((pointer.x / columns) * 2 - 1) * 1.2, -1, 1) * knobs.reach
    : 0;
  turn.tilt += (lean - turn.tilt) * (1 - Math.exp(-dt * 4));
  const down = active && pointer.down;
  if (down && !turn.wasDown) {
    turn.shake = 0;
  }
  turn.wasDown = down;
  turn.shake += dt;
  advanceTurn(turn, glass, dt, knobs.pour);

  const angle = glassAngle(turn);
  const rate = glass.total / (knobs.pour * STEPS_PER_CELL * glass.bulb);
  // A shake knocks grains loose in every direction for a moment.
  const agitation = turn.shake < 0.8 ? 0.4 * Math.exp(-4.5 * turn.shake) : 0;
  turn.owed += dt * STEPS_PER_CELL * glass.bulb;
  const steps = Math.min(MAX_STEPS, Math.floor(turn.owed));
  turn.owed = Math.min(1, turn.owed - steps);
  for (let i = 0; i < steps; i += 1) {
    step(glass, Math.sin(angle), Math.cos(angle), rate, agitation);
  }
};

/**
 * Falling Sand Hourglass. A glass hourglass in glyphs, rim-lit, with caps
 * and turned posts, and a falling-sand automaton inside at the charset's
 * sample grid. Sand streams through the neck, leaves a crater above and a
 * cone below, and when the top is empty the glass turns itself over. The
 * pointer tilts it; a press shakes it.
 */
export const HourglassScene = ({
  charset = "dense",
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
  duration = 20,
  fill = 0.6,
  sand = DEFAULT_SAND,
  finish = "walnut",
  tilt = 18,
  className,
  ...props
}: HourglassSceneProps) => {
  const sandRef = useRef<Sand | null>(null);
  const turnRef = useRef<Turn>(createTurn());
  const canvasRef = useRef<Canvas | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const tokens = useAsciiColors();

  const surface = surfaceColors({ background, colorMode, phosphor, ramp });
  const ink = sceneInk({ ansi, colorMode, grade, phosphor, ramp }, tokens);
  const pour = clamp(duration, 4, 120);
  const reach = (clamp(tilt, 0, 40) * Math.PI) / 180;
  const layers = Math.min(MAX_LAYERS, Math.max(1, sand.length));

  const draw = (context: AsciiGridDrawContext) => {
    const { frame, columns, rows, delta, metrics } = context;
    if (columns === 0 || rows === 0) {
      return;
    }
    const set = resolveCharset(charset, chars);
    const [gx, gy] = set.grid;
    const packed = set.kind === "braille" || set.kind === "quadrants";
    const sampleWidth = metrics.width / gx;
    const sampleHeight = metrics.height / gy;
    const lookup = Math.min(sampleWidth, sampleHeight);
    const nx = Math.max(1, Math.round(sampleWidth / lookup));
    const ny = Math.max(1, Math.round(sampleHeight / lookup));
    const boxWidth = columns * metrics.width;
    const boxHeight = rows * metrics.height;
    const turn = turnRef.current;

    const bulb = bulbCells(
      boxWidth,
      boxHeight,
      Math.max(sampleWidth / nx, sampleHeight / ny)
    );
    const sandKey = `${bulb}:${fill}:${layers}`;
    if (sandRef.current?.key !== sandKey) {
      sandRef.current = refill(sandRef.current, turn, {
        bulb,
        fill,
        key: sandKey,
        layers,
        pour,
      });
    }
    const glass = sandRef.current;

    const canvasKey = `${columns}x${rows}x${gx}x${gy}x${nx}x${ny}`;
    if (canvasRef.current?.key !== canvasKey) {
      canvasRef.current = createCanvas(
        columns,
        rows,
        gx,
        gy,
        nx,
        ny,
        canvasKey
      );
    }
    const canvas = canvasRef.current;
    const paletteKey = `${sand.join(",")}:${finish}:${packed}`;
    if (paletteRef.current?.key !== paletteKey) {
      paletteRef.current = createPalette(sand, finish, packed, paletteKey);
    }
    const palette = paletteRef.current;

    if (delta > 0) {
      tick(turn, glass, context, { interactive, pour, reach });
    }

    const angle = glassAngle(turn);
    const pxPerCell = viewScale(glass.bulb, angle, boxWidth, boxHeight);
    const jolt = shakeAngle(turn.shake) * glass.bulb * 0.25 * pxPerCell;
    const cos = Math.cos(angle);
    const lookupPx = Math.max(sampleWidth / nx, sampleHeight / ny);
    render(
      canvas,
      glass,
      palette,
      {
        band: -cos,
        cos,
        inverse: 1 / pxPerCell,
        sheen: packed ? 0.16 : 0,
        sin: Math.sin(angle),
        wall: Math.max(1.1, (1.15 * lookupPx) / pxPerCell),
        x: boxWidth / 2 + jolt,
        y: boxHeight / 2,
      },
      { height: sampleHeight, width: sampleWidth }
    );
    mapTones(
      canvas.field,
      columns,
      rows,
      {
        charset: set,
        colorMode: "palette",
        dither: dither ?? (packed ? "blue-noise" : "none"),
        edgeThreshold,
        grade,
        invert,
        // colorCells repaints every glyph, so give mapTones its cheapest colour path.
        palette: PLACEHOLDER_PALETTE,
        threshold,
      },
      frame
    );
    if (set.kind === "ramp") {
      outlineGlass(canvas, frame, metrics.width, metrics.height);
    }
    colorCells(canvas, frame, ink);
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
