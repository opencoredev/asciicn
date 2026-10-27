"use client";

import { useRef } from "react";

import {
  ANSI16,
  AsciiGrid,
  createToneField,
  EDGE_GLYPHS,
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
  Charset,
  MutableFrame,
  PostFx,
  Rgb8,
  ToneField,
} from "@/lib/ascii";

/** The banner's colours: the cloth, the thread its words are woven in, and the hem. */
export type WovenBannerColors = readonly [
  cloth: string,
  thread: string,
  hem: string,
];

export interface WovenBannerSceneProps extends AsciiSceneProps {
  /** The words woven into the cloth, tiled across it line after line. Default `"ASCIICN"`. */
  text?: string;
  /** Wind strength, 0 (hangs still) to 3 (a gale). Default 1. */
  wind?: number;
  /** How gusty the wind is, 0 (steady) to 3. Default 1. */
  gusts?: number;
  /** Cloth, thread and hem colours as `#rrggbb`. Default `["#a3203a", "#f6e6c4", "#e0a83e"]`. */
  colors?: WovenBannerColors;
  /** Faint wind streaks drifting through the empty sky. Default `true`. */
  streaks?: boolean;
}

const DEFAULT_COLORS: WovenBannerColors = ["#a3203a", "#f6e6c4", "#e0a83e"];

const BANNER = {
  backdrop: "#0a0c14",
  fallback: hexToRgb("#a3203a"),
  pole: hexToRgb("#c9a35a"),
  streak: hexToRgb("#6f7fa6"),
} as const;

const DEFAULT_FX: PostFx = { bloom: 0.25, vignette: 0.3 };

/** A vector's length, for the per-point loops that run every frame. */
const length3 = (x: number, y: number, z: number) =>
  // oxlint-disable-next-line unicorn/prefer-modern-math-apis -- Math.hypot is several times slower in V8, and this runs tens of thousands of times a frame.
  Math.sqrt(x * x + y * y + z * z);

/** A numeric read that treats a missing index as 0. */
const read = (data: ArrayLike<number>, index: number): number =>
  data[index] ?? 0;

// --- Colour: scene colours through the active colour mode -----------------

interface SceneInk {
  /** A scene colour, already shaded, in the active colour mode. */
  readonly tint: (rgb: Rgb8) => Rgb8;
}

const mix = (from: Rgb8, to: Rgb8, t: number): Rgb8 => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
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
      tint: (rgb) => sampleRamp(stops, 0.2 + 0.8 * brightness(rgb)),
    };
  }
  if (colorMode === "ansi16") {
    const table = ANSI16[look.ansi ?? "vga"];
    return {
      tint: (rgb) => {
        const graded = gradeRgb(rgb, grade);
        return table[nearestIndex(graded, table)] ?? graded;
      },
    };
  }
  if (colorMode === "mono" || colorMode === "palette") {
    return {
      tint: (rgb) => mix(paper, ink, 0.2 + 0.8 * brightness(rgb)),
    };
  }
  return { tint: (rgb) => gradeRgb(rgb, grade) };
};

/** Ink and paper for a look: phosphor, ramp, theme tokens or the backdrop. */
const surfaceColors = (
  look: Pick<AsciiSceneProps, "colorMode" | "phosphor" | "ramp" | "background">,
  backdrop: string
): { ink: string; paper: string } => {
  const { colorMode = "truecolor", phosphor, background = "paper" } = look;
  const ink =
    colorMode === "mono" && phosphor ? PHOSPHORS[phosphor].ink : "--ascii-ink";
  let paper = backdrop;
  if (colorMode === "mono") {
    paper = phosphor ? PHOSPHORS[phosphor].paper : "--ascii-paper";
  } else if (colorMode === "palette") {
    paper = "--ascii-paper";
  } else if (colorMode === "duotone") {
    const ramp = look.ramp ?? "sodium";
    paper = (typeof ramp === "string" ? RAMPS[ramp][0] : ramp[0]) ?? backdrop;
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
  tokens: readonly (readonly number[])[] | null,
  fallback: { ink: Rgb8; paper: Rgb8 }
): SceneInk => {
  const glass =
    look.colorMode === "mono" && look.phosphor
      ? PHOSPHORS[look.phosphor]
      : null;
  const ink = glass ? hexToRgb(glass.ink) : toBytes(tokens?.[0], fallback.ink);
  const paper = glass
    ? hexToRgb(glass.paper)
    : toBytes(tokens?.[1], fallback.paper);
  return createInk(look, ink, paper);
};

// --- The cloth --------------------------------------------------------------

/**
 * World units are metres: a 1.6 by 1 banner nailed along its left edge to
 * a pole, x right, y up, z toward the viewer.
 */
const CLOTH = {
  across: 34,
  down: 21,
  height: 1,
  poleX: -0.8,
  top: 0.5,
  width: 1.6,
} as const;

/** A woven letter's size at rest, in glyph cells. */
const LETTER = 1.04;

/** The share of the cloth's height taken by each hem band. */
const HEM = 0.07;

const GRAVITY = 3.6;
/** Air pushing on the cloth, per metre per second of wind across it. */
const AERO = 5;
/** Air dragging along the cloth's surface, which streams a flag downwind. */
const SKIN = 6;
const DAMPING = 0.992;
const ITERATIONS = 8;
const SUBSTEP = 1 / 60;

interface Cloth {
  readonly count: number;
  readonly pos: Float32Array;
  readonly prev: Float32Array;
  readonly force: Float32Array;
  /** 0 for points held by the pole or the pointer, else 1. */
  readonly free: Float32Array;
  /** Constraint endpoints as pairs, their rest lengths and stiffness. */
  readonly links: Int32Array;
  readonly rest: Float32Array;
  readonly stiffness: Float32Array;
  /** Per vertex: screen x, y (samples) and view depth. */
  readonly screen: Float32Array;
  readonly shade: Float32Array;
  /** Per vertex: 1 where the front faces the viewer, 0 for the back. */
  readonly facing: Float32Array;
  time: number;
  /** Extra wind from clicks, decaying. */
  burst: number;
  /** How far the wind streaks have drifted, in cells. */
  drift: number;
  grab: number;
  grabDepth: number;
  pressAt: number;
  pressX: number;
  pressY: number;
  wasDown: boolean;
  lastX: number;
  lastY: number;
}

const particle = (i: number, j: number) => j * CLOTH.across + i;

const createCloth = (): Cloth => {
  const { across, down, width, height, poleX, top } = CLOTH;
  const count = across * down;
  const pos = new Float32Array(count * 3);
  const free = new Float32Array(count);
  const dx = width / (across - 1);
  const dy = height / (down - 1);
  for (let j = 0; j < down; j += 1) {
    for (let i = 0; i < across; i += 1) {
      const at = particle(i, j);
      pos[at * 3] = poleX + i * dx;
      pos[at * 3 + 1] = top - j * dy;
      // A slight wave to start from, so the first gust has folds to grow.
      pos[at * 3 + 2] = 0.04 * Math.sin(i * 0.7 + j * 0.3);
      free[at] = i === 0 ? 0 : 1;
    }
  }
  const pairs: number[] = [];
  const stiff: number[] = [];
  const link = (a: number, b: number, k: number) => {
    pairs.push(a, b);
    stiff.push(k);
  };
  for (let j = 0; j < down; j += 1) {
    for (let i = 0; i < across; i += 1) {
      const a = particle(i, j);
      if (i + 1 < across) {
        link(a, particle(i + 1, j), 1);
      }
      if (j + 1 < down) {
        link(a, particle(i, j + 1), 1);
      }
      if (i + 1 < across && j + 1 < down) {
        link(a, particle(i + 1, j + 1), 0.7);
        link(particle(i + 1, j), particle(i, j + 1), 0.7);
      }
      // Bend links skip a point, so the cloth resists creasing flat.
      if (i + 2 < across) {
        link(a, particle(i + 2, j), 0.25);
      }
      if (j + 2 < down) {
        link(a, particle(i, j + 2), 0.25);
      }
    }
  }
  const links = Int32Array.from(pairs);
  const rest = new Float32Array(stiff.length);
  for (let k = 0; k < stiff.length; k += 1) {
    const a = read(links, k * 2) * 3;
    const b = read(links, k * 2 + 1) * 3;
    rest[k] = Math.hypot(
      read(pos, b) - read(pos, a),
      read(pos, b + 1) - read(pos, a + 1),
      read(pos, b + 2) - read(pos, a + 2)
    );
  }
  return {
    burst: 0,
    count,
    drift: 0,
    facing: new Float32Array(count),
    force: new Float32Array(count * 3),
    free,
    grab: -1,
    grabDepth: 0,
    lastX: -1,
    lastY: -1,
    links,
    pos,
    pressAt: 0,
    pressX: 0,
    pressY: 0,
    prev: Float32Array.from(pos),
    rest,
    screen: new Float32Array(count * 3),
    shade: new Float32Array(count),
    stiffness: Float32Array.from(stiff),
    time: 0,
    wasDown: false,
  };
};

interface Weather {
  readonly wind: number;
  readonly gusts: number;
}

/** Wind speed along +x at time `t`: a steady breeze plus slow, uneven gusts. */
const windSpeed = (cloth: Cloth, weather: Weather, t: number) => {
  const swell =
    Math.sin(t * 0.31) + 0.6 * Math.sin(t * 0.83 + 2) + 0.4 * Math.sin(t * 1.9);
  const gust = Math.max(0, swell) * 0.45 * weather.gusts;
  return weather.wind * 6 * (0.75 + gust + cloth.burst);
};

/** A hand over the cloth, in world units, from the pointer. */
interface Hand {
  /** Into the screen, in world space. */
  readonly forward: readonly [number, number, number];
  /** The pointer's motion this frame, in world space per second. */
  readonly velocity: readonly [number, number, number];
  /** Per vertex falloff weight, 0 outside the hand. */
  readonly weight: Float32Array;
}

/** Air drag on every triangle: wind against the cloth pushes along its normal. */
const addWind = (cloth: Cloth, weather: Weather, dt: number) => {
  const { pos, prev, force } = cloth;
  const { across, down, width, height } = CLOTH;
  const t = cloth.time;
  const speed = windSpeed(cloth, weather, t);
  const patch = (width / (across - 1)) * (height / (down - 1));
  const gain = AERO / (6 * patch);
  const add = (p: number, x: number, y: number, z: number) => {
    force[p * 3] = read(force, p * 3) + x;
    force[p * 3 + 1] = read(force, p * 3 + 1) + y;
    force[p * 3 + 2] = read(force, p * 3 + 2) + z;
  };
  const triangle = (a: number, b: number, c: number) => {
    const ax = read(pos, a * 3);
    const ay = read(pos, a * 3 + 1);
    const az = read(pos, a * 3 + 2);
    const ux = read(pos, b * 3) - ax;
    const uy = read(pos, b * 3 + 1) - ay;
    const uz = read(pos, b * 3 + 2) - az;
    const vx = read(pos, c * 3) - ax;
    const vy = read(pos, c * 3 + 1) - ay;
    const vz = read(pos, c * 3 + 2) - az;
    // The cross product's length is twice the area, so bigger faces catch more air.
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = length3(nx, ny, nz) + 1e-9;
    const cx = ax + (ux + vx) / 3;
    const cy = ay + (uy + vy) / 3;
    // Ripples ride downwind, and the wind veers a little in and out of the screen.
    const ripple = 1 + 0.28 * Math.sin(2.4 * cx - 3.3 * t + 1.6 * cy);
    const windX = speed * ripple;
    const windY = speed * 0.08 * Math.sin(1.3 * t + 3 * cx);
    const windZ =
      speed * (0.22 * Math.sin(1.7 * t + 2.6 * cx) + 0.1 * Math.sin(4.1 * t));
    const velX =
      read(pos, a * 3) -
      read(prev, a * 3) +
      read(pos, b * 3) -
      read(prev, b * 3) +
      read(pos, c * 3) -
      read(prev, c * 3);
    const velY =
      read(pos, a * 3 + 1) -
      read(prev, a * 3 + 1) +
      read(pos, b * 3 + 1) -
      read(prev, b * 3 + 1) +
      read(pos, c * 3 + 1) -
      read(prev, c * 3 + 1);
    const velZ =
      read(pos, a * 3 + 2) -
      read(prev, a * 3 + 2) +
      read(pos, b * 3 + 2) -
      read(prev, b * 3 + 2) +
      read(pos, c * 3 + 2) -
      read(prev, c * 3 + 2);
    const relX = windX - velX / (3 * dt);
    const relY = windY - velY / (3 * dt);
    const relZ = windZ - velZ / (3 * dt);
    const push = ((nx * relX + ny * relY + nz * relZ) / length) * gain;
    const skin = SKIN / 6;
    const fx = nx * push + relX * skin;
    const fy = ny * push + relY * skin;
    const fz = nz * push + relZ * skin;
    add(a, fx, fy, fz);
    add(b, fx, fy, fz);
    add(c, fx, fy, fz);
  };
  for (let j = 0; j < down - 1; j += 1) {
    for (let i = 0; i < across - 1; i += 1) {
      const a = particle(i, j);
      const b = particle(i + 1, j);
      const c = particle(i, j + 1);
      const d = particle(i + 1, j + 1);
      triangle(a, b, c);
      triangle(b, d, c);
    }
  }
};

const solve = (cloth: Cloth) => {
  const { pos, free, links, rest, stiffness } = cloth;
  const total = rest.length;
  for (let k = 0; k < total; k += 1) {
    const a = read(links, k * 2);
    const b = read(links, k * 2 + 1);
    const wa = read(free, a);
    const wb = read(free, b);
    const sum = wa + wb;
    if (sum === 0) {
      continue;
    }
    const dx = read(pos, b * 3) - read(pos, a * 3);
    const dy = read(pos, b * 3 + 1) - read(pos, a * 3 + 1);
    const dz = read(pos, b * 3 + 2) - read(pos, a * 3 + 2);
    const length = length3(dx, dy, dz) + 1e-9;
    const pull = ((length - read(rest, k)) / length) * read(stiffness, k);
    const sa = (pull * wa) / sum;
    const sb = (pull * wb) / sum;
    pos[a * 3] = read(pos, a * 3) + dx * sa;
    pos[a * 3 + 1] = read(pos, a * 3 + 1) + dy * sa;
    pos[a * 3 + 2] = read(pos, a * 3 + 2) + dz * sa;
    pos[b * 3] = read(pos, b * 3) - dx * sb;
    pos[b * 3 + 1] = read(pos, b * 3 + 1) - dy * sb;
    pos[b * 3 + 2] = read(pos, b * 3 + 2) - dz * sb;
  }
};

/**
 * Each point stays within its rest distance of the nail on its row, so a
 * gale can't stretch the cloth like rubber however few iterations run.
 */
const tether = (cloth: Cloth) => {
  const { pos, free } = cloth;
  const { across, down, width } = CLOTH;
  const dx = width / (across - 1);
  for (let j = 0; j < down; j += 1) {
    const anchor = particle(0, j) * 3;
    const ax = read(pos, anchor);
    const ay = read(pos, anchor + 1);
    const az = read(pos, anchor + 2);
    for (let i = 1; i < across; i += 1) {
      const p = particle(i, j);
      if (read(free, p) === 0) {
        continue;
      }
      const ox = read(pos, p * 3) - ax;
      const oy = read(pos, p * 3 + 1) - ay;
      const oz = read(pos, p * 3 + 2) - az;
      const length = length3(ox, oy, oz);
      const limit = i * dx * 1.03;
      if (length > limit) {
        const s = limit / length;
        pos[p * 3] = ax + ox * s;
        pos[p * 3 + 1] = ay + oy * s;
        pos[p * 3 + 2] = az + oz * s;
      }
    }
  }
};

const step = (
  cloth: Cloth,
  weather: Weather,
  dt: number,
  hand: Hand | null,
  grabTarget: readonly [number, number, number] | null
) => {
  const { pos, prev, force, free, count } = cloth;
  force.fill(0);
  addWind(cloth, weather, dt);
  for (let p = 0; p < count; p += 1) {
    force[p * 3 + 1] = read(force, p * 3 + 1) - GRAVITY;
  }
  if (hand) {
    // A hand presses the cloth away a little and sweeps it along with the pointer.
    const [fx, fy, fz] = hand.forward;
    const [vx, vy, vz] = hand.velocity;
    for (let p = 0; p < count; p += 1) {
      const w = read(hand.weight, p);
      if (w > 0) {
        force[p * 3] = read(force, p * 3) + w * (fx * 14 + vx * 22);
        force[p * 3 + 1] = read(force, p * 3 + 1) + w * (fy * 14 + vy * 22);
        force[p * 3 + 2] = read(force, p * 3 + 2) + w * (fz * 14 + vz * 22);
      }
    }
  }
  const dt2 = dt * dt;
  for (let p = 0; p < count; p += 1) {
    if (read(free, p) === 0) {
      continue;
    }
    for (let axis = 0; axis < 3; axis += 1) {
      const at = p * 3 + axis;
      const now = read(pos, at);
      pos[at] = now + (now - read(prev, at)) * DAMPING + read(force, at) * dt2;
      prev[at] = now;
    }
  }
  const { grab } = cloth;
  if (grab >= 0 && grabTarget) {
    // The held point follows the pointer; its old position stays as `prev`,
    // so letting go flings it.
    for (let axis = 0; axis < 3; axis += 1) {
      const at = grab * 3 + axis;
      prev[at] = read(pos, at);
      pos[at] = read(pos, at) + (read(grabTarget, axis) - read(pos, at)) * 0.5;
    }
  }
  for (let pass = 0; pass < ITERATIONS; pass += 1) {
    solve(cloth);
  }
  tether(cloth);
  cloth.burst *= Math.exp(-dt * 1.1);
  cloth.time += dt;
};

// --- The view ---------------------------------------------------------------

interface View {
  readonly cx: number;
  readonly cy: number;
  /** Samples per world unit, vertically. */
  readonly unit: number;
  /** Sample width over sample height. */
  readonly aspect: number;
  readonly camera: number;
  readonly cosYaw: number;
  readonly sinYaw: number;
  readonly cosPitch: number;
  readonly sinPitch: number;
}

/** Where the composition is centred, in world units. */
const FOCUS = { x: 0.02, y: -0.08 } as const;

const createView = (
  field: ToneField,
  aspect: number,
  time: number,
  still: boolean
): View => {
  // Fit the banner and a little sky around it, in either orientation.
  const unit = Math.min((field.width * aspect) / 2.15, field.height / 1.55);
  const yaw = -0.3 + (still ? 0 : 0.07 * Math.sin(time * 0.13));
  const pitch = 0.14;
  return {
    aspect,
    camera: 4.5,
    cosPitch: Math.cos(pitch),
    cosYaw: Math.cos(yaw),
    cx: field.width / 2,
    cy: field.height / 2,
    sinPitch: Math.sin(pitch),
    sinYaw: Math.sin(yaw),
    unit,
  };
};

/** World to screen samples; `out` gets x, y and view depth. */
const project = (
  view: View,
  x: number,
  y: number,
  z: number,
  out: Float32Array,
  at: number
) => {
  const wx = x - FOCUS.x;
  const wy = y - FOCUS.y;
  const x1 = wx * view.cosYaw + z * view.sinYaw;
  const z1 = -wx * view.sinYaw + z * view.cosYaw;
  const y2 = wy * view.cosPitch - z1 * view.sinPitch;
  const z2 = wy * view.sinPitch + z1 * view.cosPitch;
  const depth = view.camera - z2;
  const f = view.camera / depth;
  out[at] = view.cx + (x1 * f * view.unit) / view.aspect;
  out[at + 1] = view.cy - y2 * f * view.unit;
  out[at + 2] = depth;
};

/** A view-space vector back to world space. */
const toWorld = (
  view: View,
  x: number,
  y: number,
  z: number
): [number, number, number] => {
  const y1 = y * view.cosPitch + z * view.sinPitch;
  const z1 = -y * view.sinPitch + z * view.cosPitch;
  return [
    x * view.cosYaw - z1 * view.sinYaw,
    y1,
    x * view.sinYaw + z1 * view.cosYaw,
  ];
};

/** A screen sample at a view depth, back to a world point. */
const unproject = (
  view: View,
  sx: number,
  sy: number,
  depth: number
): [number, number, number] => {
  const f = view.camera / depth;
  const x = ((sx - view.cx) * view.aspect) / (view.unit * f);
  const y = -(sy - view.cy) / (view.unit * f);
  const [wx, wy, wz] = toWorld(view, x, y, view.camera - depth);
  return [wx + FOCUS.x, wy + FOCUS.y, wz];
};

/** The light, in view space: high and to the left, toward the viewer. */
const LIGHT = (() => {
  const x = -0.5;
  const y = 0.6;
  const z = 0.62;
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length] as const;
})();

const HALF = (() => {
  const [x, y, lz] = LIGHT;
  const z = lz + 1;
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length] as const;
})();

/** Project every point and light it from its normal, which side faces us decides the side. */
const projectCloth = (cloth: Cloth, view: View) => {
  const { pos, screen, shade, facing, count } = cloth;
  const { across, down } = CLOTH;
  for (let p = 0; p < count; p += 1) {
    project(
      view,
      read(pos, p * 3),
      read(pos, p * 3 + 1),
      read(pos, p * 3 + 2),
      screen,
      p * 3
    );
  }
  for (let j = 0; j < down; j += 1) {
    const up = particle(0, Math.max(0, j - 1));
    const below = particle(0, Math.min(down - 1, j + 1));
    for (let i = 0; i < across; i += 1) {
      const left = particle(Math.max(0, i - 1), j) * 3;
      const right = particle(Math.min(across - 1, i + 1), j) * 3;
      const top = (up + i) * 3;
      const bottom = (below + i) * 3;
      const ax = read(pos, right) - read(pos, left);
      const ay = read(pos, right + 1) - read(pos, left + 1);
      const az = read(pos, right + 2) - read(pos, left + 2);
      const bx = read(pos, bottom) - read(pos, top);
      const by = read(pos, bottom + 1) - read(pos, top + 1);
      const bz = read(pos, bottom + 2) - read(pos, top + 2);
      // Down the cloth crossed with across it points out of the front.
      let nx = by * az - bz * ay;
      let ny = bz * ax - bx * az;
      let nz = bx * ay - by * ax;
      // Into view space: yaw, then pitch.
      const x1 = nx * view.cosYaw + nz * view.sinYaw;
      const z1 = -nx * view.sinYaw + nz * view.cosYaw;
      const y2 = ny * view.cosPitch - z1 * view.sinPitch;
      const z2 = ny * view.sinPitch + z1 * view.cosPitch;
      const length = length3(x1, y2, z2) + 1e-9;
      const side = z2 >= 0 ? 1 : -1;
      nx = (x1 / length) * side;
      ny = (y2 / length) * side;
      nz = (z2 / length) * side;
      const diffuse = Math.max(
        0,
        nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
      );
      const gloss = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
      const p = particle(i, j);
      shade[p] = Math.min(1, 0.14 + 0.92 * diffuse + 0.35 * gloss ** 24);
      facing[p] = side > 0 ? 1 : 0;
    }
  }
};

// --- Drawing ----------------------------------------------------------------

const KIND = { cloth: 1, empty: 0, finial: 3, pole: 2, streak: 4 } as const;

interface Buffers {
  readonly key: string;
  readonly field: ToneField;
  readonly rgb: Uint8ClampedArray;
  readonly depth: Float32Array;
  readonly u: Float32Array;
  readonly v: Float32Array;
  readonly shade: Float32Array;
  readonly facing: Float32Array;
  readonly kind: Uint8Array;
  /** Which character of the woven text a sample shows, or -1 for none. */
  readonly letter: Int32Array;
  /** Which text cell (line and column) a sample lies in, or -1 off the words. */
  readonly stitch: Int32Array;
  readonly gx: number;
  readonly gy: number;
}

const createBuffers = (
  columns: number,
  rows: number,
  charset: Charset,
  key: string
): Buffers => {
  const field = createToneField(columns, rows, charset);
  const size = field.width * field.height;
  return {
    depth: new Float32Array(size),
    facing: new Float32Array(size),
    field,
    gx: charset.grid[0],
    gy: charset.grid[1],
    key,
    kind: new Uint8Array(size),
    letter: new Int32Array(size),
    rgb: new Uint8ClampedArray(size * 3),
    shade: new Float32Array(size),
    stitch: new Int32Array(size),
    u: new Float32Array(size),
    v: new Float32Array(size),
  };
};

/** Fill one triangle into the depth buffer, carrying UV, light and side. */
const rasterTriangle = (
  buffers: Buffers,
  cloth: Cloth,
  ia: number,
  ib: number,
  ic: number
) => {
  const { screen } = cloth;
  const ax = read(screen, ia * 3);
  const ay = read(screen, ia * 3 + 1);
  const bx = read(screen, ib * 3);
  const by = read(screen, ib * 3 + 1);
  const cx = read(screen, ic * 3);
  const cy = read(screen, ic * 3 + 1);
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-6) {
    return;
  }
  const { field, depth, u, v, shade, facing, kind } = buffers;
  const { width, height } = field;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
  if (minX > maxX || minY > maxY) {
    return;
  }
  const inverse = 1 / area;
  const { across, down } = CLOTH;
  const ua = (ia % across) / (across - 1);
  const ub = (ib % across) / (across - 1);
  const uc = (ic % across) / (across - 1);
  const va = Math.floor(ia / across) / (down - 1);
  const vb = Math.floor(ib / across) / (down - 1);
  const vc = Math.floor(ic / across) / (down - 1);
  const za = read(screen, ia * 3 + 2);
  const zb = read(screen, ib * 3 + 2);
  const zc = read(screen, ic * 3 + 2);
  const sa = read(cloth.shade, ia);
  const sb = read(cloth.shade, ib);
  const sc = read(cloth.shade, ic);
  const fa = read(cloth.facing, ia);
  const fb = read(cloth.facing, ib);
  const fc = read(cloth.facing, ic);
  for (let y = minY; y <= maxY; y += 1) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inverse;
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inverse;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) {
        continue;
      }
      const z = w0 * za + w1 * zb + w2 * zc;
      const index = y * width + x;
      if (z >= read(depth, index)) {
        continue;
      }
      depth[index] = z;
      u[index] = w0 * ua + w1 * ub + w2 * uc;
      v[index] = w0 * va + w1 * vb + w2 * vc;
      shade[index] = w0 * sa + w1 * sb + w2 * sc;
      facing[index] = w0 * fa + w1 * fb + w2 * fc;
      kind[index] = KIND.cloth;
    }
  }
};

const rasterCloth = (buffers: Buffers, cloth: Cloth) => {
  const { across, down } = CLOTH;
  for (let j = 0; j < down - 1; j += 1) {
    for (let i = 0; i < across - 1; i += 1) {
      const a = particle(i, j);
      const b = particle(i + 1, j);
      const c = particle(i, j + 1);
      const d = particle(i + 1, j + 1);
      rasterTriangle(buffers, cloth, a, b, c);
      rasterTriangle(buffers, cloth, b, d, c);
    }
  }
};

const POLE = { bottom: -1.6, finial: 0.02, radius: 0.008 } as const;

/** The pole: a brass rod lit from the left, with a ball on top. */
const drawPole = (buffers: Buffers, view: View, scratch: Float32Array) => {
  const { field, depth, kind, shade } = buffers;
  const { width, height } = field;
  const top = CLOTH.top + 0.06;
  project(view, CLOTH.poleX, top, 0, scratch, 0);
  project(view, CLOTH.poleX, POLE.bottom, 0, scratch, 3);
  const x0 = read(scratch, 0);
  const y0 = read(scratch, 1);
  const z0 = read(scratch, 2);
  const x1 = read(scratch, 3);
  const y1 = read(scratch, 4);
  const half = Math.max(0.5, (POLE.radius * view.unit) / view.aspect);
  const firstRow = Math.max(0, Math.floor(y0));
  const lastRow = Math.min(height - 1, Math.ceil(y1));
  for (let y = firstRow; y <= lastRow; y += 1) {
    const t = (y + 0.5 - y0) / Math.max(1e-6, y1 - y0);
    const centre = x0 + (x1 - x0) * t;
    const from = Math.max(0, Math.round(centre - half));
    const to = Math.min(
      width - 1,
      Math.max(from, Math.round(centre + half) - 1)
    );
    for (let x = from; x <= to; x += 1) {
      const index = y * width + x;
      if (z0 < read(depth, index)) {
        depth[index] = z0;
        kind[index] = KIND.pole;
        const across = (x + 0.5 - centre) / Math.max(half, 0.5);
        shade[index] = 0.95 - 0.35 * Math.max(-1, Math.min(1, across));
      }
    }
  }
  // The ball sits on top, slightly in front of the rod.
  // At least one sample tall, so the ball survives small boxes.
  const radius = Math.max(0.75, POLE.finial * view.unit);
  for (
    let y = Math.max(0, Math.floor(y0 - radius * 2));
    y <= Math.min(height - 1, Math.ceil(y0));
    y += 1
  ) {
    for (
      let x = Math.max(0, Math.floor(x0 - radius / view.aspect - 1));
      x <= Math.min(width - 1, Math.ceil(x0 + radius / view.aspect + 1));
      x += 1
    ) {
      const ox = ((x + 0.5 - x0) * view.aspect) / radius;
      const oy = (y + 0.5 - (y0 - radius)) / radius;
      const d = ox * ox + oy * oy;
      const index = y * width + x;
      if (d <= 1 && z0 - 0.01 < read(depth, index)) {
        depth[index] = z0 - 0.01;
        kind[index] = KIND.finial;
        shade[index] = Math.min(
          1,
          0.5 + 0.6 * Math.max(0, -ox * 0.6 - oy * 0.6 + 0.3)
        );
      }
    }
  }
};

const STREAKS = 16;

/** Faint wind lines drifting through the sky behind the banner. */
const drawStreaks = (buffers: Buffers, cloth: Cloth, time: number) => {
  const { field, kind, shade, gx, gy } = buffers;
  const { width, height } = field;
  const columns = width / gx;
  const span = columns * 1.5;
  for (let s = 0; s < STREAKS; s += 1) {
    const seed = Math.sin(s * 91.7) * 43_758.5453;
    const random = seed - Math.floor(seed);
    const lane = (s + 0.5) / STREAKS;
    const length = 4 + Math.floor(random * 8);
    const pace = 0.6 + random * 0.8;
    const head =
      ((((random * span + cloth.drift * pace) % span) + span) % span) -
      columns * 0.25;
    const row = Math.floor(
      (lane * 0.92 + 0.04) * height + Math.sin(time * 0.4 + s) * gy * 0.8
    );
    if (row < 0 || row >= height) {
      continue;
    }
    for (let k = 0; k < length; k += 1) {
      const column = head - k;
      const x = Math.floor(column * gx);
      if (x < 0 || x >= width) {
        continue;
      }
      const wave = Math.round(Math.sin(column * 0.3 + time) * gy * 0.4);
      const y = Math.min(height - 1, Math.max(0, row + wave));
      const index = y * width + x;
      if (read(kind, index) === KIND.empty) {
        kind[index] = KIND.streak;
        // Bright at the head, fading along the tail.
        shade[index] = 0.32 * (1 - k / length) + 0.08;
      }
    }
  }
};

interface Weave {
  readonly tile: readonly string[];
  /** Text cells across and down the cloth, about one per glyph cell at rest. */
  readonly columns: number;
  readonly lines: number;
  readonly cloth: Rgb8;
  readonly thread: Rgb8;
  readonly hem: Rgb8;
  /** Letters show above this light; darker folds fall back to the ramp. */
  readonly cut: number;
  /** How much dimmer the weave between letters is. */
  readonly gap: number;
  /** One sample per glyph cell, so letters are drawn as glyphs. */
  readonly letters: boolean;
}

/** Turn depth, UV and light into tones, colours and letters. */
const compose = (buffers: Buffers, weave: Weave) => {
  const { field, kind, u, v, shade, facing, rgb, letter, stitch } = buffers;
  const { tones, width } = field;
  const size = tones.length;
  const { tile } = weave;
  const tileLength = Math.max(1, tile.length);
  for (let index = 0; index < size; index += 1) {
    const what = read(kind, index);
    letter[index] = -1;
    stitch[index] = -1;
    if (what === KIND.empty) {
      tones[index] = 0;
      continue;
    }
    const light = read(shade, index);
    let color: Rgb8 = BANNER.pole;
    let tone = light;
    let dyed = 0;
    if (what === KIND.streak) {
      color = BANNER.streak;
    } else if (what === KIND.cloth) {
      const front = read(facing, index) >= 0.5;
      const sv = read(v, index);
      if (sv < HEM || sv > 1 - HEM) {
        color = weave.hem;
        tone = light * (front ? 1 : 0.7);
      } else if (front) {
        const tv = ((sv - HEM) / (1 - 2 * HEM)) * weave.lines;
        const line = Math.floor(tv);
        const column = Math.floor(read(u, index) * weave.columns);
        // Each line starts three letters on, so the words lie like brickwork.
        const at =
          (((column + line * 3) % tileLength) + tileLength) % tileLength;
        const id = line * 4096 + column;
        stitch[index] = id;
        // Where the cloth stretches a text cell over two glyph cells, the
        // second shows weave, so a letter is never drawn twice.
        const repeat =
          weave.letters &&
          ((index % width > 0 && read(stitch, index - 1) === id) ||
            (index >= width && read(stitch, index - width) === id));
        const glyph = repeat ? " " : (tile[at] ?? " ");
        if (glyph === " ") {
          color = weave.cloth;
          tone = light * weave.gap;
        } else {
          color = weave.thread;
          // Thread sinks into the cloth's dye as the light falls off.
          dyed = 0.75 * (1 - light);
          letter[index] = light >= weave.cut ? at : -1;
          tone = Math.min(1, light * 1.05 + 0.04);
        }
      } else {
        // The back of the weave: the cloth colour, a shade darker, no words.
        color = weave.cloth;
        tone = light * 0.72;
      }
    }
    tones[index] = tone;
    const level = Math.min(1, 0.18 + 0.82 * tone);
    const dye = weave.cloth;
    rgb[index * 3] = (color[0] + (dye[0] - color[0]) * dyed) * level;
    rgb[index * 3 + 1] = (color[1] + (dye[1] - color[1]) * dyed) * level;
    rgb[index * 3 + 2] = (color[2] + (dye[2] - color[2]) * dyed) * level;
  }
};

const EDGE_SET = new Set<string>(EDGE_GLYPHS);

/** On one-sample charsets, letters replace the ramp and the pole draws as a rod. */
const placeLetters = (
  buffers: Buffers,
  frame: MutableFrame,
  tile: readonly string[],
  edges: boolean
) => {
  const { kind, letter } = buffers;
  const { glyphs } = frame;
  for (let index = 0; index < glyphs.length; index += 1) {
    const what = read(kind, index);
    if (what === KIND.pole) {
      glyphs[index] = "|";
    } else if (what === KIND.finial) {
      glyphs[index] = "o";
    } else if (what === KIND.cloth) {
      const at = read(letter, index);
      if (at >= 0 && !(edges && EDGE_SET.has(glyphs[index] ?? " "))) {
        glyphs[index] = tile[at] ?? glyphs[index] ?? " ";
      }
    }
  }
};

/** Colour every inked cell from its samples, weighted by tone. */
const colorCells = (buffers: Buffers, frame: MutableFrame, ink: SceneInk) => {
  const { field, rgb, gx, gy } = buffers;
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
      for (let dy = 0; dy < gy; dy += 1) {
        const base = (row * gy + dy) * field.width + column * gx;
        for (let dx = 0; dx < gx; dx += 1) {
          const tone = read(field.tones, base + dx);
          if (tone > 0) {
            r += read(rgb, (base + dx) * 3) * tone;
            g += read(rgb, (base + dx) * 3 + 1) * tone;
            b += read(rgb, (base + dx) * 3 + 2) * tone;
            weight += tone;
          }
        }
      }
      const source: Rgb8 =
        weight > 0 ? [r / weight, g / weight, b / weight] : BANNER.fallback;
      const [cr, cg, cb] = ink.tint(source);
      colors[cell * 4] = cr;
      colors[cell * 4 + 1] = cg;
      colors[cell * 4 + 2] = cb;
      colors[cell * 4 + 3] = 255;
    }
  }
};

// --- Pointer ----------------------------------------------------------------

/** Within this many cells of a point, a press grabs the cloth. */
const GRAB_REACH = 2.5;

interface PointerResult {
  readonly hand: Hand | null;
  readonly grabTarget: [number, number, number] | null;
}

/** The free point nearest a screen sample, within reach of a press, or -1. */
const nearestPoint = (
  cloth: Cloth,
  sx: number,
  sy: number,
  gx: number,
  gy: number
) => {
  const { screen, count } = cloth;
  let best = -1;
  let bestDistance = GRAB_REACH * GRAB_REACH;
  for (let p = 0; p < count; p += 1) {
    const dx = (read(screen, p * 3) - sx) / gx;
    const dy = (read(screen, p * 3 + 1) - sy) / gy;
    const d = dx * dx + dy * dy;
    if (d < bestDistance && read(cloth.free, p) > 0) {
      bestDistance = d;
      best = p;
    }
  }
  return best;
};

/** Fill each point's share of the hand; false when the hand misses the cloth. */
const handWeights = (
  cloth: Cloth,
  view: View,
  sx: number,
  sy: number,
  weight: Float32Array
) => {
  const { screen, count } = cloth;
  // The hand's reach on screen, in samples of world-unit size.
  const reach = 0.2 * view.unit;
  let any = false;
  for (let p = 0; p < count; p += 1) {
    const dx = (read(screen, p * 3) - sx) * view.aspect;
    const dy = read(screen, p * 3 + 1) - sy;
    const w = Math.exp(-(dx * dx + dy * dy) / (reach * reach));
    weight[p] = w > 0.02 ? w : 0;
    any = any || w > 0.02;
  }
  return any;
};

/**
 * Hover presses and sweeps the cloth; a press on it grabs the nearest
 * point and drags it; a press on the sky, or a quick tap on the cloth,
 * sends a gust.
 */
const readPointer = (
  cloth: Cloth,
  view: View,
  buffers: Buffers,
  context: AsciiGridDrawContext,
  weight: Float32Array,
  interactive: boolean
): PointerResult => {
  const { pointer, delta } = context;
  const { gx, gy } = buffers;
  const active = interactive && pointer.inside;
  const down = active && pointer.down;
  const sx = pointer.x * gx;
  const sy = pointer.y * gy;
  const { screen } = cloth;
  const now = cloth.time;

  if (down && !cloth.wasDown) {
    const best = nearestPoint(cloth, sx, sy, gx, gy);
    cloth.pressAt = now;
    cloth.pressX = pointer.x;
    cloth.pressY = pointer.y;
    if (best >= 0) {
      cloth.grab = best;
      cloth.grabDepth = read(screen, best * 3 + 2);
      cloth.free[best] = 0;
    } else {
      cloth.burst += 1.4;
    }
  } else if (!down && cloth.wasDown && cloth.grab >= 0) {
    const moved = Math.hypot(
      pointer.x - cloth.pressX,
      pointer.y - cloth.pressY
    );
    if (now - cloth.pressAt < 0.3 && moved < 1.5) {
      cloth.burst += 1.4;
    }
    cloth.free[cloth.grab] = 1;
    cloth.grab = -1;
  }
  cloth.wasDown = down;

  const moved = active && cloth.lastX >= 0 && delta > 0;
  const stepX = moved ? pointer.x - cloth.lastX : 0;
  const stepY = moved ? pointer.y - cloth.lastY : 0;
  cloth.lastX = active ? pointer.x : -1;
  cloth.lastY = active ? pointer.y : -1;

  if (cloth.grab >= 0) {
    return {
      grabTarget: unproject(view, sx, sy, cloth.grabDepth),
      hand: null,
    };
  }
  if (!active) {
    return { grabTarget: null, hand: null };
  }
  const any = handWeights(cloth, view, sx, sy, weight);
  if (!any) {
    return { grabTarget: null, hand: null };
  }
  const perSecond = 1 / Math.max(delta, 1e-3);
  const vx = ((stepX * gx * view.aspect) / view.unit) * perSecond;
  const vy = ((-stepY * gy) / view.unit) * perSecond;
  return {
    grabTarget: null,
    hand: {
      forward: toWorld(view, 0, 0, -1),
      velocity: toWorld(view, vx, vy, 0),
      weight,
    },
  };
};

/** How much dimmer the gaps between words are, per charset kind. */
const weaveGap = (set: Charset) => {
  // Sobel reads every letter-to-gap step as an edge, so the edge set weaves flat.
  if (set.kind === "edge") {
    return 1;
  }
  // Glyph ramps keep gaps to their quiet end (dots and ticks), so the
  // words stand out; dots only need the gaps a little darker.
  return set.kind === "braille" || set.kind === "quadrants" ? 0.5 : 0.4;
};

// --- The scene --------------------------------------------------------------

const clampKnob = (value: number) => Math.min(3, Math.max(0, value));

/** A fresh banner, blown for a few seconds so its first frame is already flying. */
const warmCloth = (weather: Weather, start: number): Cloth => {
  const cloth = createCloth();
  cloth.time = Math.max(0, start - 3);
  for (let warm = 0; warm < 180; warm += 1) {
    step(cloth, weather, SUBSTEP, null, null);
  }
  return cloth;
};

interface Scratch {
  readonly weight: Float32Array;
  readonly points: Float32Array;
}

/**
 * Woven Banner. A cloth banner nailed to a pole, simulated as a Verlet
 * mass-spring mesh with structural, shear and bend links, blown by gusty
 * wind that pushes on every triangle. The text is tiled across the cloth
 * in UV space, so its letters stretch, fold and foreshorten with the
 * fabric; the mesh is z-buffered at the charset's sample grid and lit
 * from its normals, and dark folds fall back to the density ramp. Hover
 * to press the cloth, drag to pull a point, click for a gust.
 */
export const WovenBannerScene = ({
  charset = "standard",
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
  stillTime = 2.5,
  interactive = true,
  handle,
  text = "ASCIICN",
  wind = 1,
  gusts = 1,
  colors = DEFAULT_COLORS,
  streaks = true,
  className,
  ...props
}: WovenBannerSceneProps) => {
  const clothRef = useRef<Cloth | null>(null);
  const buffersRef = useRef<Buffers | null>(null);
  const scratchRef = useRef<Scratch | null>(null);
  const tileRef = useRef<{ text: string; tile: readonly string[] } | null>(
    null
  );
  const tokens = useAsciiColors();

  const surface = surfaceColors(
    { background, colorMode, phosphor, ramp },
    BANNER.backdrop
  );
  const ink = sceneInk({ ansi, colorMode, grade, phosphor, ramp }, tokens, {
    ink: [240, 232, 220],
    paper: hexToRgb(BANNER.backdrop),
  });
  const weather: Weather = { gusts: clampKnob(gusts), wind: clampKnob(wind) };
  const [clothHex, threadHex, hemHex] = colors;
  const fabric = hexToRgb(clothHex);
  const thread = hexToRgb(threadHex);
  const palette = {
    cloth: fabric,
    // Dots can't draw letters, so there the words only lift the cloth's colour.
    dotThread: mix(fabric, thread, 0.35),
    hem: hexToRgb(hemHex),
    thread,
  };

  const draw = (context: AsciiGridDrawContext) => {
    const { frame, columns, rows, time, delta, metrics } = context;
    clothRef.current ??= warmCloth(weather, time);
    const cloth = clothRef.current;
    scratchRef.current ??= {
      points: new Float32Array(6),
      weight: new Float32Array(cloth.count),
    };
    const scratch = scratchRef.current;
    if (tileRef.current?.text !== text) {
      // A trailing space parts one repeat of the text from the next.
      const words = text.trim().length > 0 ? text.trim() : "ASCIICN";
      tileRef.current = { text, tile: [...`${words} `] };
    }
    const { tile } = tileRef.current;

    const set = resolveCharset(charset, chars);
    const [gx, gy] = set.grid;
    const packed = set.kind === "braille" || set.kind === "quadrants";
    const key = `${columns}x${rows}x${gx}x${gy}`;
    if (buffersRef.current?.key !== key) {
      buffersRef.current = createBuffers(columns, rows, set, key);
    }
    const buffers = buffersRef.current;
    const aspect = metrics.width / gx / (metrics.height / gy);
    const view = createView(buffers.field, aspect, time, delta === 0);

    if (delta > 0) {
      projectCloth(cloth, view);
      const { hand, grabTarget } = readPointer(
        cloth,
        view,
        buffers,
        context,
        scratch.weight,
        interactive
      );
      const dt = Math.min(delta, 0.05);
      const steps = Math.min(3, Math.max(1, Math.round(dt / SUBSTEP)));
      for (let s = 0; s < steps; s += 1) {
        step(cloth, weather, dt / steps, hand, grabTarget);
      }
      // Streaks drift at the wind's pace, in cells per second.
      cloth.drift += dt * (3 + windSpeed(cloth, weather, cloth.time) * 2.2);
    }
    projectCloth(cloth, view);

    buffers.depth.fill(Number.POSITIVE_INFINITY);
    buffers.kind.fill(KIND.empty);
    rasterCloth(buffers, cloth);
    drawPole(buffers, view, scratch.points);
    if (streaks) {
      drawStreaks(buffers, cloth, time);
    }

    // A woven letter is about one glyph cell where the cloth lies flat, so
    // flat cloth reads cleanly and folds visibly bunch or spread the words.
    const across = Math.max(
      4,
      Math.round((CLOTH.width * view.unit * view.cosYaw) / aspect / gx / LETTER)
    );
    const lines = Math.max(
      2,
      Math.round((CLOTH.height * (1 - 2 * HEM) * view.unit) / gy / LETTER)
    );
    const edges = set.kind === "edge";
    compose(buffers, {
      cloth: palette.cloth,
      columns: across,
      cut: 0.34,
      gap: weaveGap(set),
      hem: palette.hem,
      letters: !packed,
      lines,
      thread: packed ? palette.dotThread : palette.thread,
      tile,
    });

    mapTones(
      buffers.field,
      columns,
      rows,
      {
        charset: set,
        colorMode: "palette",
        dither: dither ?? (packed ? "bayer4" : "none"),
        edgeThreshold,
        grade,
        invert,
        threshold,
      },
      frame
    );
    if (!packed) {
      placeLetters(buffers, frame, tile, edges);
    }
    colorCells(buffers, frame, ink);
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
