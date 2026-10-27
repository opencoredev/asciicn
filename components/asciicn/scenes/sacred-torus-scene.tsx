"use client";

import { useRef } from "react";

import {
  ANSI16,
  AsciiGrid,
  createToneField,
  edgeChar,
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

/** A torus knot: the tube winds `p` times around the axis and `q` times through the hole. */
export type KnotType = readonly [p: number, q: number];

export interface SacredTorusSceneProps extends AsciiSceneProps {
  /** The knots it morphs between, in order. Default `[[2, 3], [3, 5], [5, 2], [3, 4], [2, 7]]`. */
  knots?: readonly KnotType[];
  /** Seconds each knot holds before morphing into the next. Default 5. */
  hold?: number;
  /** Tube thickness relative to the knot, 0.04 to 0.3. Default 0.12. */
  tube?: number;
  /** The wireframe polyhedra orbiting the knot. Default `true`. */
  solids?: boolean;
  /** The faint circle and hexagram behind the knot. Default `true`. */
  sigil?: boolean;
  /**
   * With ramp charsets (`standard`, `dense`, `edge` or `chars`), draw
   * `- / | \` where the surface turns away, following its outline.
   * Default `true`.
   */
  contours?: boolean;
}

const DEFAULT_KNOTS: readonly KnotType[] = [
  [2, 3],
  [3, 5],
  [5, 2],
  [3, 4],
  [2, 7],
];

const TORUS = {
  backdrop: "#06040d",
  fallback: hexToRgb("#5a4b8a"),
  sigil: hexToRgb("#6b5bd6"),
  solid: hexToRgb("#ffd27a"),
  solidFar: hexToRgb("#a8742e"),
} as const;

const DEFAULT_FX: PostFx = { bloom: 0.4, vignette: 0.35 };

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
    const ramp = look.ramp ?? "orchid";
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
  backdrop: string,
  defaultRamp: string
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
    const ramp = look.ramp ?? defaultRamp;
    const stops =
      typeof ramp === "string"
        ? (RAMPS[ramp as keyof typeof RAMPS] ?? RAMPS.orchid)
        : ramp;
    paper = stops[0] ?? backdrop;
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

// --- Buffers, allocated once per grid size -----------------------------------

interface Buffers {
  readonly key: string;
  readonly field: ToneField;
  readonly rgb: Uint8ClampedArray;
  readonly depth: Float32Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
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
    field,
    gx: charset.grid[0],
    gy: charset.grid[1],
    key,
    nx: new Float32Array(size),
    ny: new Float32Array(size),
    nz: new Float32Array(size),
    rgb: new Uint8ClampedArray(size * 3),
  };
};

interface Mesh {
  readonly segments: number;
  readonly sides: number;
  /** Screen x, screen y, depth per vertex. */
  readonly screen: Float32Array;
  /** View-space normal per vertex. */
  readonly normal: Float32Array;
  /** Knot centre line, reused while building. */
  readonly spine: Float32Array;
}

const SEGMENTS = 220;
const SIDES = 14;

const createMesh = (): Mesh => ({
  normal: new Float32Array(SEGMENTS * SIDES * 3),
  screen: new Float32Array(SEGMENTS * SIDES * 3),
  segments: SEGMENTS,
  sides: SIDES,
  spine: new Float32Array(SEGMENTS * 3),
});

// --- Geometry -------------------------------------------------------------------

const knotPoint = (p: number, q: number, t: number, out: number[]) => {
  const r = 2 + Math.cos(q * t);
  out[0] = (r * Math.cos(p * t)) / 3;
  out[1] = (r * Math.sin(p * t)) / 3;
  out[2] = Math.sin(q * t) / 3;
};

const smoothstep = (t: number) => {
  const c = t > 0 ? Math.min(t, 1) : 0;
  return c * c * (3 - 2 * c);
};

type Vec3 = readonly [number, number, number];

/** Unit-radius vertices and the edges between nearest neighbours. */
const polyhedron = (
  vertices: readonly Vec3[]
): {
  vertices: readonly Vec3[];
  edges: readonly (readonly [number, number])[];
} => {
  const unit = vertices.map(([x, y, z]) => {
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length] as const;
  });
  let nearest = Number.POSITIVE_INFINITY;
  for (let a = 0; a < unit.length; a += 1) {
    for (let b = a + 1; b < unit.length; b += 1) {
      const va = unit[a];
      const vb = unit[b];
      if (va && vb) {
        nearest = Math.min(
          nearest,
          Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2])
        );
      }
    }
  }
  const edges: [number, number][] = [];
  for (let a = 0; a < unit.length; a += 1) {
    for (let b = a + 1; b < unit.length; b += 1) {
      const va = unit[a];
      const vb = unit[b];
      if (
        va &&
        vb &&
        Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]) < nearest * 1.01
      ) {
        edges.push([a, b]);
      }
    }
  }
  return { edges, vertices: unit };
};

const PHI = (1 + Math.sqrt(5)) / 2;

const cyclic = (a: number, b: number): Vec3[] =>
  [-1, 1].flatMap((sa) =>
    [-1, 1].flatMap((sb) => [
      [0, sa * a, sb * b] as const,
      [sa * a, sb * b, 0] as const,
      [sb * b, 0, sa * a] as const,
    ])
  );

const SOLIDS = [
  polyhedron(cyclic(1, PHI)),
  polyhedron([
    ...[-1, 1].flatMap((x) =>
      [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as const))
    ),
    ...cyclic(1 / PHI, PHI),
  ]),
  polyhedron([
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]),
];

// --- Rendering ------------------------------------------------------------------

interface View {
  readonly cx: number;
  readonly cy: number;
  readonly unit: number;
  readonly aspect: number;
  readonly camera: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
}

/** Rotate a model-space vector into view space (z toward the viewer). */
const rotate = (view: View, x: number, y: number, z: number, out: number[]) => {
  const cr = Math.cos(view.roll);
  const sr = Math.sin(view.roll);
  const x1 = x * cr - y * sr;
  const y1 = x * sr + y * cr;
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const x2 = x1 * cy + z * sy;
  const z2 = -x1 * sy + z * cy;
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  out[0] = x2;
  out[1] = y1 * cp - z2 * sp;
  out[2] = y1 * sp + z2 * cp;
};

const project = (
  view: View,
  x: number,
  y: number,
  z: number,
  out: number[]
) => {
  const depth = view.camera - z;
  const f = view.camera / depth;
  out[0] = view.cx + (x * f * view.unit) / view.aspect;
  out[1] = view.cy - y * f * view.unit;
  out[2] = depth;
};

const buildMesh = (
  mesh: Mesh,
  view: View,
  from: KnotType,
  to: KnotType,
  blend: number,
  tube: number
) => {
  const { segments, sides, spine, screen, normal } = mesh;
  const a: number[] = [0, 0, 0];
  const b: number[] = [0, 0, 0];
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    knotPoint(from[0], from[1], t, a);
    knotPoint(to[0], to[1], t, b);
    for (let k = 0; k < 3; k += 1) {
      spine[i * 3 + k] = read(a, k) + (read(b, k) - read(a, k)) * blend;
    }
  }
  const world: number[] = [0, 0, 0];
  const rotated: number[] = [0, 0, 0];
  const projected: number[] = [0, 0, 0];
  for (let i = 0; i < segments; i += 1) {
    const prev = ((i - 1 + segments) % segments) * 3;
    const next = ((i + 1) % segments) * 3;
    const px = read(spine, i * 3);
    const py = read(spine, i * 3 + 1);
    const pz = read(spine, i * 3 + 2);
    let tx = read(spine, next) - read(spine, prev);
    let ty = read(spine, next + 1) - read(spine, prev + 1);
    let tz = read(spine, next + 2) - read(spine, prev + 2);
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // The frame follows the radial direction, which closes on itself
    // around the loop, so the tube never twists at the seam.
    const rl = Math.hypot(px, py) || 1;
    let nx = px / rl;
    let ny = py / rl;
    let nz = 0;
    const along = nx * tx + ny * ty + nz * tz;
    nx -= tx * along;
    ny -= ty * along;
    nz -= tz * along;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;
    for (let j = 0; j < sides; j += 1) {
      const angle = (j / sides) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const ox = nx * c + bx * s;
      const oy = ny * c + by * s;
      const oz = nz * c + bz * s;
      const at = (i * sides + j) * 3;
      rotate(view, ox, oy, oz, rotated);
      normal[at] = read(rotated, 0);
      normal[at + 1] = read(rotated, 1);
      normal[at + 2] = read(rotated, 2);
      world[0] = px + ox * tube;
      world[1] = py + oy * tube;
      world[2] = pz + oz * tube;
      rotate(view, world[0], world[1], world[2], rotated);
      project(
        view,
        read(rotated, 0),
        read(rotated, 1),
        read(rotated, 2),
        projected
      );
      screen[at] = read(projected, 0);
      screen[at + 1] = read(projected, 1);
      screen[at + 2] = read(projected, 2);
    }
  }
};

/** Fill one triangle into the depth and normal buffers. */
const rasterTriangle = (
  buffers: Buffers,
  mesh: Mesh,
  ia: number,
  ib: number,
  ic: number
) => {
  const { screen, normal } = mesh;
  const ax = read(screen, ia * 3);
  const ay = read(screen, ia * 3 + 1);
  const bx = read(screen, ib * 3);
  const by = read(screen, ib * 3 + 1);
  const cx = read(screen, ic * 3);
  const cy = read(screen, ic * 3 + 1);
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  // Faces turned away from the viewer are hidden by the near side anyway.
  if (area <= 0) {
    return;
  }
  const { field, depth, nx, ny, nz } = buffers;
  const { width, height } = field;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
  if (minX > maxX || minY > maxY) {
    return;
  }
  const inverse = 1 / area;
  const az = read(screen, ia * 3 + 2);
  const bz = read(screen, ib * 3 + 2);
  const cz = read(screen, ic * 3 + 2);
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
      const z = w0 * az + w1 * bz + w2 * cz;
      const index = y * width + x;
      if (z >= read(depth, index)) {
        continue;
      }
      depth[index] = z;
      nx[index] =
        w0 * read(normal, ia * 3) +
        w1 * read(normal, ib * 3) +
        w2 * read(normal, ic * 3);
      ny[index] =
        w0 * read(normal, ia * 3 + 1) +
        w1 * read(normal, ib * 3 + 1) +
        w2 * read(normal, ic * 3 + 1);
      nz[index] =
        w0 * read(normal, ia * 3 + 2) +
        w1 * read(normal, ib * 3 + 2) +
        w2 * read(normal, ic * 3 + 2);
    }
  }
};

const LIGHT = (() => {
  const l = [-0.45, 0.62, 0.64];
  const length = Math.hypot(read(l, 0), read(l, 1), read(l, 2));
  return l.map((value) => value / length);
})();

/** Light the knot: diffuse, a tight highlight and a rim, with a hue by normal. */
const shadeKnot = (buffers: Buffers, time: number) => {
  const { field, depth, nx, ny, nz, rgb } = buffers;
  const [lx = 0, ly = 0, lz = 0] = LIGHT;
  // Half vector between the light and a viewer looking down -z.
  const hl = Math.hypot(lx, ly, lz + 1);
  const hx = lx / hl;
  const hy = ly / hl;
  const hz = (lz + 1) / hl;
  const drift = time * 0.035;
  for (let index = 0; index < field.tones.length; index += 1) {
    if (read(depth, index) === Number.POSITIVE_INFINITY) {
      continue;
    }
    let x = read(nx, index);
    let y = read(ny, index);
    let z = read(nz, index);
    const length = Math.hypot(x, y, z) || 1;
    x /= length;
    y /= length;
    z /= length;
    nx[index] = x;
    ny[index] = y;
    nz[index] = z;
    const diffuse = Math.max(0, x * lx + y * ly + z * lz);
    const specular = Math.max(0, x * hx + y * hy + z * hz) ** 42;
    const rim = (1 - Math.max(0, z)) ** 3;
    field.tones[index] = Math.min(
      1,
      0.06 + 0.8 * diffuse ** 0.85 + 0.6 * specular + 0.16 * rim
    );
    // Thin-film hue: shifts with the normal's direction and the rim.
    const hue = 0.58 + 0.32 * x + 0.22 * y + 0.45 * rim + drift;
    const light = 0.28 + 0.72 * diffuse;
    for (let channel = 0; channel < 3; channel += 1) {
      const wave = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (hue + channel / 3));
      const base = 0.18 + 0.82 * wave;
      rgb[index * 3 + channel] =
        (base * light + specular * 0.9 + rim * 0.25) * 255;
    }
  }
};

/** A depth-tested line: hidden where the knot is in front. */
const depthLine = (
  buffers: Buffers,
  a: readonly number[],
  b: readonly number[],
  near: Rgb8,
  far: Rgb8,
  nearDepth: number,
  span: number,
  solidTone: boolean
) => {
  const { field, depth, rgb } = buffers;
  const ax = read(a, 0);
  const ay = read(a, 1);
  const az = read(a, 2);
  const bx = read(b, 0);
  const by = read(b, 1);
  const bz = read(b, 2);
  const steps = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1));
  // Across the line, in screen space, so contours draw the glyph along it.
  const length = Math.hypot(bx - ax, by - ay) || 1;
  const acrossX = -(by - ay) / length;
  const acrossY = (bx - ax) / length;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = Math.floor(ax + (bx - ax) * t);
    const y = Math.floor(ay + (by - ay) * t);
    if (x < 0 || y < 0 || x >= field.width || y >= field.height) {
      continue;
    }
    const z = az + (bz - az) * t;
    const index = y * field.width + x;
    if (z > read(depth, index) - 0.02) {
      continue;
    }
    const closeness = Math.min(1, Math.max(0, 1 - (z - nearDepth) / span));
    const tone = solidTone ? 1 : 0.45 + 0.5 * closeness;
    field.tones[index] = tone;
    const [red, green, blue] = mix(far, near, closeness);
    rgb[index * 3] = red;
    rgb[index * 3 + 1] = green;
    rgb[index * 3 + 2] = blue;
    // A line drawn over the knot takes its depth so later lines layer.
    depth[index] = z;
    buffers.nz[index] = 0;
    buffers.nx[index] = acrossX;
    buffers.ny[index] = -acrossY;
  }
};

/** A faint circle and rotating hexagram, only where nothing else is drawn. */
const drawSigil = (buffers: Buffers, view: View, time: number) => {
  const { field, depth, rgb } = buffers;
  const radius = view.unit * 1.32;
  const put = (x: number, y: number, tone: number) => {
    const sx = Math.floor(x);
    const sy = Math.floor(y);
    if (sx < 0 || sy < 0 || sx >= field.width || sy >= field.height) {
      return;
    }
    const index = sy * field.width + sx;
    if (depth[index] !== Number.POSITIVE_INFINITY) {
      return;
    }
    field.tones[index] = Math.max(read(field.tones, index), tone);
    const [r, g, b] = TORUS.sigil;
    rgb[index * 3] = r;
    rgb[index * 3 + 1] = g;
    rgb[index * 3 + 2] = b;
  };
  const steps = Math.ceil(radius * 7);
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    // A dotted ring reads as a ring in every charset.
    if (i % 3 !== 0) {
      put(
        view.cx + (Math.cos(angle) * radius) / view.aspect,
        view.cy + Math.sin(angle) * radius,
        0.32
      );
    }
  }
  const turn = time * 0.05;
  for (let triangle = 0; triangle < 2; triangle += 1) {
    for (let side = 0; side < 3; side += 1) {
      const a0 =
        turn +
        (triangle * Math.PI) / 3 +
        (side * Math.PI * 2) / 3 -
        Math.PI / 2;
      const a1 = a0 + (Math.PI * 2) / 3;
      const x0 = view.cx + (Math.cos(a0) * radius) / view.aspect;
      const y0 = view.cy + Math.sin(a0) * radius;
      const x1 = view.cx + (Math.cos(a1) * radius) / view.aspect;
      const y1 = view.cy + Math.sin(a1) * radius;
      const length = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
      for (let s = 0; s <= length; s += 2) {
        put(x0 + ((x1 - x0) * s) / length, y0 + ((y1 - y0) * s) / length, 0.24);
      }
    }
  }
};

/**
 * Colour every inked cell from its samples, weighted by tone, so a thin
 * Braille edge keeps its full colour.
 */
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
        weight > 0 ? [r / weight, g / weight, b / weight] : TORUS.fallback;
      const [cr, cg, cb] = ink.tint(
        source,
        weight > 0 ? 0.4 + 0.6 * peak : 0.5
      );
      colors[cell * 4] = cr;
      colors[cell * 4 + 1] = cg;
      colors[cell * 4 + 2] = cb;
      colors[cell * 4 + 3] = 255;
    }
  }
};

const CONTOUR_SETS = new Set(["standard", "dense", "edge", "custom"]);

/** Directional glyphs where the surface turns edge-on to the viewer. */
const drawContours = (buffers: Buffers, frame: MutableFrame) => {
  const { field, depth, nx, ny, nz } = buffers;
  for (let index = 0; index < field.tones.length; index += 1) {
    if (read(depth, index) === Number.POSITIVE_INFINITY) {
      continue;
    }
    const z = nz[index] ?? 1;
    if (z < 0.24 && z > -0.2) {
      // The outline runs across the normal; screen y points down.
      frame.glyphs[index] = edgeChar(read(nx, index), -read(ny, index));
    }
  }
};

// --- Finish: CRT effects --------------------------------------------------------

interface PoseState {
  dragPitch: number;
  dragYaw: number;
  lastX: number;
  lastY: number;
  tiltX: number;
  tiltY: number;
  wasDown: boolean;
}

/** Drag turns the knot; hovering tilts it toward the pointer. */
const updatePose = (
  pose: PoseState,
  { pointer, columns, rows, delta }: AsciiGridDrawContext,
  interactive: boolean
) => {
  const down = interactive && pointer.down;
  if (down && pose.wasDown) {
    pose.dragYaw += (pointer.x - pose.lastX) * 0.05;
    pose.dragPitch += (pointer.y - pose.lastY) * 0.09;
  }
  pose.wasDown = down;
  pose.lastX = pointer.x;
  pose.lastY = pointer.y;
  const ease = delta > 0 ? 1 - Math.exp(-delta * 3) : 1;
  const hovering = interactive && pointer.inside && !down;
  const targetX = hovering ? pointer.x / columns - 0.5 : 0;
  const targetY = hovering ? pointer.y / rows - 0.5 : 0;
  pose.tiltX += (targetX - pose.tiltX) * ease;
  pose.tiltY += (targetY - pose.tiltY) * ease;
};

/** The two knots on either side of `time`, and how far between them. */
const knotBlend = (
  knots: readonly KnotType[],
  hold: number,
  time: number
): { from: KnotType; to: KnotType; morph: number } => {
  const list = knots.length > 0 ? knots : DEFAULT_KNOTS;
  const still = Math.max(0.5, hold);
  const period = still + 2.5;
  const step = Math.max(0, time) / period;
  const index = Math.floor(step) % list.length;
  const from = list[index] ?? [2, 3];
  if (list.length < 2) {
    return { from, morph: 0, to: from };
  }
  const to = list[(index + 1) % list.length] ?? from;
  const into = (step - Math.floor(step)) * period - still;
  return { from, morph: smoothstep(into / 2.5), to };
};

/** Every quad of the tube as two triangles. */
const rasterMesh = (buffers: Buffers, mesh: Mesh) => {
  const { segments, sides } = mesh;
  for (let i = 0; i < segments; i += 1) {
    const i1 = (i + 1) % segments;
    for (let j = 0; j < sides; j += 1) {
      const j1 = (j + 1) % sides;
      const a = i * sides + j;
      const c = i1 * sides + j1;
      rasterTriangle(buffers, mesh, a, i1 * sides + j, c);
      rasterTriangle(buffers, mesh, a, c, i * sides + j1);
    }
  }
};

/** The polyhedra: each spins on its own axis while orbiting the knot. */
const drawSolids = (
  buffers: Buffers,
  view: View,
  time: number,
  packed: boolean
) => {
  const rotated: number[] = [0, 0, 0];
  for (const [which, solid] of SOLIDS.entries()) {
    const orbit = time * 0.32 + (which * Math.PI * 2) / SOLIDS.length;
    const ox = Math.cos(orbit) * 1.45;
    const oy = Math.sin(orbit * 1.3) * 0.28;
    const oz = Math.sin(orbit) * 1.45;
    const size = 0.17 + 0.03 * Math.sin(time * 1.1 + which * 2);
    const spin = time * (0.6 + which * 0.25);
    const cs = Math.cos(spin);
    const ss = Math.sin(spin);
    const ct = Math.cos(spin * 0.7);
    const st = Math.sin(spin * 0.7);
    const points = solid.vertices.map(([x, y, z]) => {
      const sx = x * cs - z * ss;
      const sz = x * ss + z * cs;
      const sy = y * ct - sz * st;
      const tz = y * st + sz * ct;
      rotate(view, ox + sx * size, oy + sy * size, oz + tz * size, rotated);
      const out: number[] = [0, 0, 0];
      project(view, read(rotated, 0), read(rotated, 1), read(rotated, 2), out);
      return out;
    });
    for (const [a, b] of solid.edges) {
      const va = points[a];
      const vb = points[b];
      if (va && vb) {
        depthLine(
          buffers,
          va,
          vb,
          TORUS.solid,
          TORUS.solidFar,
          view.camera - 1.6,
          3.2,
          packed
        );
      }
    }
  }
};

/**
 * Sacred Geometry Torus Knot. A z-buffered 3D torus knot tube, lit with a
 * diffuse term, a tight highlight and an iridescent hue that follows the
 * surface normal, slowly morphing between knot types while wireframe
 * polyhedra orbit it. Ramp charsets trace the outline with `- / | \`
 * glyphs from the normal. Drag to turn it; hover to tilt it.
 */
export const SacredTorusScene = ({
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
  knots = DEFAULT_KNOTS,
  hold = 5,
  tube = 0.12,
  solids = true,
  sigil = true,
  contours = true,
  className,
  ...props
}: SacredTorusSceneProps) => {
  const buffersRef = useRef<Buffers | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const poseRef = useRef<PoseState>({
    dragPitch: 0,
    dragYaw: 0,
    lastX: 0,
    lastY: 0,
    tiltX: 0,
    tiltY: 0,
    wasDown: false,
  });
  const tokens = useAsciiColors();

  const surface = surfaceColors(
    { background, colorMode, phosphor, ramp },
    TORUS.backdrop,
    "orchid"
  );
  const ink = sceneInk({ ansi, colorMode, grade, phosphor, ramp }, tokens, {
    ink: [230, 220, 255],
    paper: hexToRgb(TORUS.backdrop),
  });

  const draw = (context: AsciiGridDrawContext) => {
    const { frame, columns, rows, time, metrics } = context;
    const set = resolveCharset(charset, chars);
    const [gx, gy] = set.grid;
    // Dots and quadrants shade a lit surface by ordered dithering.
    const packed = set.kind === "braille" || set.kind === "quadrants";
    const key = `${columns}x${rows}x${gx}x${gy}`;
    if (buffersRef.current?.key !== key) {
      buffersRef.current = createBuffers(columns, rows, set, key);
    }
    const buffers = buffersRef.current;
    meshRef.current ??= createMesh();
    const mesh = meshRef.current;
    const { field } = buffers;
    field.tones.fill(0);
    buffers.rgb.fill(0);
    buffers.depth.fill(Number.POSITIVE_INFINITY);

    const pose = poseRef.current;
    updatePose(pose, context, interactive);
    const aspect = metrics.width / gx / (metrics.height / gy);
    const view: View = {
      aspect,
      camera: 4,
      cx: field.width / 2,
      cy: field.height / 2,
      pitch:
        0.55 + Math.sin(time * 0.17) * 0.25 + pose.tiltY * 0.9 + pose.dragPitch,
      roll: time * 0.11,
      unit: Math.min(field.width * aspect, field.height) * 0.36,
      yaw: time * 0.21 + pose.tiltX * 1.2 + pose.dragYaw,
    };

    const { from, to, morph } = knotBlend(knots, hold, time);
    buildMesh(mesh, view, from, to, morph, Math.min(0.3, Math.max(0.04, tube)));
    rasterMesh(buffers, mesh);
    shadeKnot(buffers, time);
    if (solids) {
      drawSolids(buffers, view, time, packed);
    }
    if (sigil) {
      drawSigil(buffers, view, time);
    }

    mapTones(
      field,
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
    if (contours && !packed && CONTOUR_SETS.has(set.id)) {
      drawContours(buffers, frame);
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
