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

export interface FluidSmokeSceneProps extends AsciiSceneProps {
  /** How hard hot smoke rises, 0 to 3. Default 1. */
  buoyancy?: number;
  /** Curl and eddies: vorticity confinement plus curl-noise turbulence, 0 to 3. Default 1. */
  swirl?: number;
  /** How fast smoke and heat fade, 0 to 3. Default 1. */
  fade?: number;
  /** Where the plume rises from, 0 (left) to 1 (right). `null` turns it off. Default 0.5. */
  emitter?: number | null;
}

// Temperature from cold smoke to the white-hot core.
const PLUME = [
  "#2a2f7a",
  "#5b4bd0",
  "#b8479b",
  "#ff7a4a",
  "#ffc46b",
  "#fff4dc",
].map(hexToRgb);

const SMOKE = {
  backdrop: "#05040a",
  fallback: hexToRgb("#4b3bb0"),
} as const;

const DEFAULT_FX: PostFx = { bloom: 0.3 };

/** A numeric read that treats a missing index as 0. */
const read = (data: ArrayLike<number>, index: number): number =>
  data[index] ?? 0;

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
    const ramp = look.ramp ?? "ember";
    const stops = (typeof ramp === "string" ? RAMPS[ramp] : ramp).map(hexToRgb);
    return {
      tint: (rgb, level = 1) =>
        sampleRamp(stops, 0.25 + 0.75 * brightness(rgb) * level),
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
        mix(paper, ink, 0.22 + 0.78 * brightness(rgb) * level),
    };
  }
  return {
    tint: (rgb, level = 1) => gradeRgb(scale(rgb, level), grade),
  };
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
    const ramp = look.ramp ?? "ember";
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

// --- The fluid ------------------------------------------------------------------

/**
 * A stable-fluids solver on a coarse grid: semi-Lagrangian advection,
 * vorticity confinement and a Jacobi pressure solve that keeps the flow
 * divergence-free. Density and temperature ride along with the flow.
 */
interface Fluid {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly u: Float32Array;
  readonly v: Float32Array;
  readonly u0: Float32Array;
  readonly v0: Float32Array;
  readonly density: Float32Array;
  readonly density0: Float32Array;
  readonly heat: Float32Array;
  readonly heat0: Float32Array;
  readonly pressure: Float32Array;
  readonly divergence: Float32Array;
  readonly curl: Float32Array;
  /**
   * The turbulence stream function, two separable waves: per-column
   * factors and their slopes, then per-row ones. Rebuilt every step, so
   * the curl costs a few multiplies per cell.
   */
  readonly waveX: Float32Array;
  readonly waveY: Float32Array;
  time: number;
  pointerX: number;
  pointerY: number;
  wasDown: boolean;
}

const MAX_CELLS = 10_000;

const createFluid = (
  columns: number,
  rows: number,
  cellAspect: number,
  key: string
): Fluid => {
  // Square simulation cells over the box's true shape.
  const boxAspect = (columns * cellAspect) / Math.max(1, rows);
  let width = Math.max(24, Math.min(170, Math.round(columns * 0.85)));
  let height = Math.max(16, Math.round(width / boxAspect));
  if (width * height > MAX_CELLS) {
    const shrink = Math.sqrt(MAX_CELLS / (width * height));
    width = Math.max(16, Math.round(width * shrink));
    height = Math.max(12, Math.round(height * shrink));
  }
  const size = width * height;
  const make = () => new Float32Array(size);
  return {
    curl: make(),
    density: make(),
    density0: make(),
    divergence: make(),
    heat: make(),
    heat0: make(),
    height,
    key,
    pointerX: -1,
    pointerY: -1,
    pressure: make(),
    time: 0,
    u: make(),
    u0: make(),
    v: make(),
    v0: make(),
    wasDown: false,
    waveX: new Float32Array(width * 4),
    waveY: new Float32Array(height * 4),
    width,
  };
};

/** Bilinear read with clamped edges. */
const sample = (
  data: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number
) => {
  const cx = Math.min(width - 1.001, Math.max(0, x));
  const cy = Math.min(height - 1.001, Math.max(0, y));
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  const fx = cx - ix;
  const fy = cy - iy;
  const at = iy * width + ix;
  const a = read(data, at);
  const b = read(data, at + 1);
  const c = read(data, at + width);
  const d = read(data, at + width + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

const advect = (
  fluid: Fluid,
  target: Float32Array,
  source: Float32Array,
  dt: number
) => {
  const { width, height, u, v } = fluid;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      target[index] = sample(
        source,
        width,
        height,
        x - dt * read(u, index),
        y - dt * read(v, index)
      );
    }
  }
};

const project = (fluid: Fluid, iterations: number) => {
  const { width, height, u, v, pressure, divergence } = fluid;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      divergence[index] =
        -0.5 *
        (read(u, index + 1) -
          read(u, index - 1) +
          read(v, index + width) -
          read(v, index - width));
    }
  }
  pressure.fill(0);
  for (let pass = 0; pass < iterations; pass += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        pressure[index] =
          (read(divergence, index) +
            read(pressure, index - 1) +
            read(pressure, index + 1) +
            read(pressure, index - width) +
            read(pressure, index + width)) /
          4;
      }
    }
  }
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      u[index] =
        read(u, index) -
        0.5 * (read(pressure, index + 1) - read(pressure, index - 1));
      v[index] =
        read(v, index) -
        0.5 * (read(pressure, index + width) - read(pressure, index - width));
    }
  }
  // Walls on the sides and floor; the top stays open so smoke can leave.
  for (let y = 0; y < height; y += 1) {
    u[y * width] = 0;
    u[y * width + width - 1] = 0;
  }
  for (let x = 0; x < width; x += 1) {
    v[(height - 1) * width + x] = 0;
  }
};

const confine = (fluid: Fluid, strength: number, dt: number) => {
  const { width, height, u, v, curl } = fluid;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      curl[index] =
        0.5 *
        (read(v, index + 1) -
          read(v, index - 1) -
          read(u, index + width) +
          read(u, index - width));
    }
  }
  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      const index = y * width + x;
      const gx =
        Math.abs(read(curl, index + 1)) - Math.abs(read(curl, index - 1));
      const gy =
        Math.abs(read(curl, index + width)) -
        Math.abs(read(curl, index - width));
      const length = Math.hypot(gx, gy) + 1e-5;
      const w = read(curl, index);
      u[index] = read(u, index) + (gy / length) * w * strength * dt;
      v[index] = read(v, index) - (gx / length) * w * strength * dt;
    }
  }
};

interface Forces {
  readonly buoyancy: number;
  readonly swirl: number;
  readonly fade: number;
  readonly emitter: number | null;
}

interface Stir {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly active: boolean;
  readonly down: boolean;
  readonly pressed: boolean;
}

const splat = (
  fluid: Fluid,
  cx: number,
  cy: number,
  radius: number,
  apply: (index: number, weight: number, ox: number, oy: number) => void
) => {
  const { width, height } = fluid;
  const r = Math.ceil(radius * 2);
  for (
    let y = Math.max(0, Math.floor(cy) - r);
    y <= Math.min(height - 1, Math.floor(cy) + r);
    y += 1
  ) {
    for (
      let x = Math.max(0, Math.floor(cx) - r);
      x <= Math.min(width - 1, Math.floor(cx) + r);
      x += 1
    ) {
      const ox = x - cx;
      const oy = y - cy;
      const weight = Math.exp(-(ox * ox + oy * oy) / (radius * radius));
      if (weight > 0.01) {
        apply(y * width + x, weight, ox, oy);
      }
    }
  }
};

/**
 * The two waves of the turbulence stream function at time `t`: for each
 * column A, A', C, C' and for each row B, B', D, D'. Wavelengths are in cells, so the
 * eddies keep their size on any grid.
 */
const buildWaves = (fluid: Fluid, t: number) => {
  const { width, height, waveX, waveY } = fluid;
  const k1 = (Math.PI * 2) / 26;
  const k2 = (Math.PI * 2) / 11;
  for (let x = 0; x < width; x += 1) {
    const p1 = k1 * x + t * 0.6;
    const p2 = k2 * x - t * 1.1 + 1.7;
    waveX[x * 4] = Math.sin(p1);
    waveX[x * 4 + 1] = Math.cos(p1);
    waveX[x * 4 + 2] = 0.5 * Math.sin(p2);
    waveX[x * 4 + 3] = 0.5 * Math.cos(p2);
  }
  for (let y = 0; y < height; y += 1) {
    const p1 = k1 * 0.8 * y - t * 0.45;
    const p2 = k2 * 1.2 * y + t * 0.9 + 0.4;
    waveY[y * 4] = Math.sin(p1);
    waveY[y * 4 + 1] = Math.cos(p1);
    waveY[y * 4 + 2] = 0.5 * Math.sin(p2);
    waveY[y * 4 + 3] = 0.5 * Math.cos(p2);
  }
};

const step = (fluid: Fluid, dt: number, forces: Forces, stir: Stir | null) => {
  const { width, height, u, v, u0, v0, density, density0, heat, heat0 } = fluid;
  const t = fluid.time;
  const unit = height / 60;

  // The plume: a wandering hot source near the floor.
  if (forces.emitter !== null) {
    const ex =
      width *
      (forces.emitter + 0.06 * Math.sin(t * 0.7) + 0.03 * Math.sin(t * 1.9));
    const ey = height - 3 - unit * 2;
    const radius = Math.max(2, width * 0.045);
    splat(fluid, ex, ey, radius, (index, weight) => {
      density[index] = Math.min(4, read(density, index) + 3.4 * weight * dt);
      heat[index] = Math.min(3, read(heat, index) + 3.6 * weight * dt);
      v[index] = read(v, index) - 26 * unit * weight * dt;
      u[index] = read(u, index) + 6 * unit * Math.sin(t * 1.3) * weight * dt;
    });
  }

  // The pointer stirs; holding it down pours dye, a press makes a puff.
  if (stir?.active) {
    const radius = Math.max(2, width * 0.035);
    const push = stir.down ? 0.9 : 0.35;
    splat(fluid, stir.x, stir.y, radius, (index, weight) => {
      u[index] = read(u, index) + stir.dx * push * weight;
      v[index] = read(v, index) + stir.dy * push * weight;
      if (stir.down) {
        density[index] = Math.min(4, read(density, index) + 7 * weight * dt);
        heat[index] = Math.min(3, read(heat, index) + 3.2 * weight * dt);
      }
    });
    if (stir.pressed) {
      splat(fluid, stir.x, stir.y, radius * 1.8, (index, weight, ox, oy) => {
        const length = Math.hypot(ox, oy) + 0.5;
        density[index] = Math.min(4, read(density, index) + 1.6 * weight);
        heat[index] = Math.min(3, read(heat, index) + 1.2 * weight);
        u[index] = read(u, index) + (ox / length) * 14 * unit * weight;
        v[index] = read(v, index) + (oy / length) * 14 * unit * weight;
      });
    }
  }

  // Heat rises; a drifting curl field keeps the column restless.
  const lift = 9 * unit * forces.buoyancy;
  const turbulence = 22 * unit * forces.swirl * dt;
  buildWaves(fluid, t);
  const { waveX, waveY } = fluid;
  for (let y = 1; y < height - 1; y += 1) {
    const by = read(waveY, y * 4);
    const slopeBy = read(waveY, y * 4 + 1);
    const dy = read(waveY, y * 4 + 2);
    const slopeDy = read(waveY, y * 4 + 3);
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const hot = read(heat, index);
      v[index] = read(v, index) - lift * hot * dt;
      if (hot > 0.02 || read(density, index) > 0.02) {
        const ax = read(waveX, x * 4);
        const slopeAx = read(waveX, x * 4 + 1);
        const cx = read(waveX, x * 4 + 2);
        const slopeCx = read(waveX, x * 4 + 3);
        // u = dψ/dy, v = -dψ/dx for ψ = A(x)B(y) + C(x)D(y).
        u[index] = read(u, index) + (ax * slopeBy + cx * slopeDy) * turbulence;
        v[index] = read(v, index) - (slopeAx * by + slopeCx * dy) * turbulence;
      }
    }
  }
  confine(fluid, 16 * forces.swirl, dt);

  // Move the velocity along itself, then make it divergence-free.
  u0.set(u);
  v0.set(v);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const px = x - dt * read(u0, index);
      const py = y - dt * read(v0, index);
      u[index] = sample(u0, width, height, px, py);
      v[index] = sample(v0, width, height, px, py);
    }
  }
  project(fluid, 12);

  density0.set(density);
  heat0.set(heat);
  advect(fluid, density, density0, dt);
  advect(fluid, heat, heat0, dt);
  const smokeKeep = Math.exp(-dt * 0.42 * forces.fade);
  const heatKeep = Math.exp(-dt * 0.9 * forces.fade);
  const drag = Math.exp(-dt * 0.4);
  for (let index = 0; index < density.length; index += 1) {
    density[index] = read(density, index) * smokeKeep;
    heat[index] = read(heat, index) * heatKeep;
    u[index] = read(u, index) * drag;
    v[index] = read(v, index) * drag;
  }
  // Smoke leaving through the open top fades out over the last rows.
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      density[index] = read(density, index) * (0.6 + y * 0.12);
    }
  }
  fluid.time += dt;
};

const FIXED_STEP = 1 / 30;

// --- Drawing --------------------------------------------------------------------

interface Canvas {
  readonly key: string;
  readonly field: ToneField;
  readonly rgb: Uint8ClampedArray;
  /** Per sample column: the simulation cell to its left and the blend. */
  readonly columnIndex: Int32Array;
  readonly columnWeight: Float32Array;
  readonly gx: number;
  readonly gy: number;
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
    id: "smoke",
    kind: "ramp",
    label: "smoke",
  });
  return {
    columnIndex: new Int32Array(field.width),
    columnWeight: new Float32Array(field.width),
    field,
    gx,
    gy,
    key,
    rgb: new Uint8ClampedArray(field.width * field.height * 3),
  };
};

// The plume ramp as 256 steps, so sampling it allocates nothing.
const PLUME_STEPS = (() => {
  const steps = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i += 1) {
    steps.set(sampleRamp(PLUME, i / 255), i * 3);
  }
  return steps;
})();

/**
 * Upsample the simulation to the charset's sample grid. Bilinear weights
 * are separable, so each column's and each row's source cell and weight
 * are worked out once, not per sample.
 */
const render = (canvas: Canvas, fluid: Fluid) => {
  const { field, rgb, columnIndex, columnWeight } = canvas;
  const { width, height, density, heat } = fluid;
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
      const smoke =
        (read(density, at) * (1 - wx) + read(density, at + 1) * wx) * (1 - wy) +
        (read(density, at + width) * (1 - wx) +
          read(density, at + width + 1) * wx) *
          wy;
      const hot =
        (read(heat, at) * (1 - wx) + read(heat, at + 1) * wx) * (1 - wy) +
        (read(heat, at + width) * (1 - wx) + read(heat, at + width + 1) * wx) *
          wy;
      const index = y * field.width + x;
      const tone = 1 - Math.exp(-Math.max(0, smoke) * 1.15);
      field.tones[index] = tone;
      const shade =
        Math.round(Math.min(1, 0.06 + hot * 0.5 + tone * 0.3) * 255) * 3;
      rgb[index * 3] = read(PLUME_STEPS, shade);
      rgb[index * 3 + 1] = read(PLUME_STEPS, shade + 1);
      rgb[index * 3 + 2] = read(PLUME_STEPS, shade + 2);
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
        weight > 0 ? [r / weight, g / weight, b / weight] : SMOKE.fallback;
      const [cr, cg, cb] = ink.tint(
        source,
        weight > 0 ? 0.45 + 0.55 * peak : 0.5
      );
      colors[cell * 4] = cr;
      colors[cell * 4 + 1] = cg;
      colors[cell * 4 + 2] = cb;
      colors[cell * 4 + 3] = 255;
    }
  }
};

const clampKnob = (value: number) => Math.min(3, Math.max(0, value));

/** The pointer in simulation cells, and how far it moved this frame. */
const readStir = (
  fluid: Fluid,
  { pointer, columns, rows }: AsciiGridDrawContext,
  dt: number,
  interactive: boolean
): Stir => {
  const x = (pointer.x / columns) * fluid.width;
  const y = (pointer.y / rows) * fluid.height;
  const active = interactive && pointer.inside;
  const moved = active && fluid.pointerX >= 0;
  const down = active && pointer.down;
  const gain = 0.12 / Math.max(dt, 1e-3);
  const stir: Stir = {
    active,
    down,
    dx: moved ? (x - fluid.pointerX) * gain : 0,
    dy: moved ? (y - fluid.pointerY) * gain : 0,
    pressed: down && !fluid.wasDown,
    x,
    y,
  };
  fluid.pointerX = active ? x : -1;
  fluid.pointerY = active ? y : -1;
  fluid.wasDown = down;
  return stir;
};

/** A fresh simulation, run ahead so its first frame already shows a plume. */
const warmFluid = (
  context: AsciiGridDrawContext,
  forces: Forces,
  key: string
): Fluid => {
  const { columns, rows, metrics, time } = context;
  const fluid = createFluid(columns, rows, metrics.width / metrics.height, key);
  fluid.time = Math.max(0, time - 3);
  for (let warm = 0; warm < 90; warm += 1) {
    step(fluid, FIXED_STEP, forces, null);
  }
  return fluid;
};

const toForces = ({
  buoyancy = 1,
  swirl = 1,
  fade = 1,
  emitter = 0.5,
}: Pick<
  FluidSmokeSceneProps,
  "buoyancy" | "swirl" | "fade" | "emitter"
>): Forces => ({
  buoyancy: clampKnob(buoyancy),
  emitter: emitter === null ? null : Math.min(0.95, Math.max(0.05, emitter)),
  fade: clampKnob(fade),
  swirl: clampKnob(swirl),
});

/**
 * Interactive Curl-Noise Plume. A real 2D fluid: semi-Lagrangian
 * advection, vorticity confinement and a Jacobi pressure solve, fed by a
 * rising plume of hot smoke. Density sets the glyph, temperature the
 * colour. Move the pointer to stir it, hold to pour dye, press for a puff.
 */
export const FluidSmokeScene = ({
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
  buoyancy,
  swirl,
  fade,
  emitter,
  className,
  ...props
}: FluidSmokeSceneProps) => {
  const fluidRef = useRef<Fluid | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const tokens = useAsciiColors();

  const surface = surfaceColors(
    { background, colorMode, phosphor, ramp },
    SMOKE.backdrop
  );
  const ink = sceneInk({ ansi, colorMode, grade, phosphor, ramp }, tokens, {
    ink: [230, 230, 240],
    paper: hexToRgb(SMOKE.backdrop),
  });
  const forces = toForces({ buoyancy, emitter, fade, swirl });

  const draw = (context: AsciiGridDrawContext) => {
    const { frame, columns, rows, delta } = context;
    const fluidKey = `${columns}x${rows}`;
    if (fluidRef.current?.key !== fluidKey) {
      fluidRef.current = warmFluid(context, forces, fluidKey);
    }
    const fluid = fluidRef.current;

    const set = resolveCharset(charset, chars);
    const [gx, gy] = set.grid;
    // Dots and quadrants show density as dot coverage, not a hard edge.
    const packed = set.kind === "braille" || set.kind === "quadrants";
    const canvasKey = `${columns}x${rows}x${gx}x${gy}`;
    if (canvasRef.current?.key !== canvasKey) {
      canvasRef.current = createCanvas(columns, rows, gx, gy, canvasKey);
    }
    const canvas = canvasRef.current;

    if (delta > 0) {
      const dt = Math.min(delta, 0.05);
      const stir = readStir(fluid, context, dt, interactive);
      // Fixed steps keep the solver stable at any frame rate; a press
      // puffs once, on the first of them.
      const steps = Math.min(3, Math.max(1, Math.round(dt / FIXED_STEP)));
      step(fluid, dt / steps, forces, stir);
      for (let i = 1; i < steps; i += 1) {
        step(fluid, dt / steps, forces, { ...stir, pressed: false });
      }
    }

    render(canvas, fluid);
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
        threshold,
      },
      frame
    );
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
