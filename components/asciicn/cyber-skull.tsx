"use client";

import { useEffect, useRef } from "react";
import type { ComponentProps, KeyboardEvent, RefObject } from "react";

import {
  AsciiGrid,
  CrtOverlay,
  createToneField,
  edgeChar,
  hexToRgb,
  mapTones,
  PHOSPHORS,
  RAMPS,
  resolveCharset,
  useAsciiColors,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiHandle,
  AsciiLook,
  MapOptions,
  MutableFrame,
  Rgb8,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * How the skull is drawn.
 * - `solid`: lit faces in tone glyphs.
 * - `wire`: the visible edges of the mesh only, in edge glyphs.
 * - `both`: lit faces with the main edges drawn over them.
 */
export const SKULL_SHADINGS = ["solid", "wire", "both"] as const;
export type SkullShading = (typeof SKULL_SHADINGS)[number];

/**
 * How faces are lit.
 * - `faceted`: one tone per face, so the low-poly mesh shows.
 * - `smooth`: normals blended across faces, for a rounded bone.
 */
export const SKULL_SURFACES = ["faceted", "smooth"] as const;
export type SkullSurface = (typeof SKULL_SURFACES)[number];

export interface CyberSkullProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Default `"both"`. */
  shading?: SkullShading;
  /** Default `"faceted"`. */
  surface?: SkullSurface;
  /** Turn around the vertical axis, in radians per second. Negative turns the other way. Default 0.3. */
  speed?: number;
  /** Open and close the jaw. Default `true`. */
  jaw?: boolean;
  /** A bright band that sweeps down the skull. Default `true`. */
  scan?: boolean;
  /** A glow deep in each eye socket. Default `true`. */
  eyes?: boolean;
  /** Bone colour in truecolor. Default `"--ascii-ink"`. */
  color?: AsciiColor;
  /** Edges, rim light, scan band and eyes in truecolor. Default `"blue"`. */
  accent?: AsciiColor;
  /** Drag or use the arrow keys to turn it. Default `true`. */
  interactive?: boolean;
  /** Cell height in CSS pixels. Default 10. */
  cell?: number;
  /** `false` holds one still frame. Default `true`. */
  animate?: boolean;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

/* -------------------------------------------------------------------------- */
/* Look                                                                        */
/* -------------------------------------------------------------------------- */

const toBytes = ([r, g, b]: readonly number[]): Rgb8 => [
  Math.round((r ?? 0) * 255),
  Math.round((g ?? 0) * 255),
  Math.round((b ?? 0) * 255),
];

const rampPaper = (ramp: AsciiLook["ramp"]): string => {
  if (typeof ramp === "string") {
    return (RAMPS[ramp as keyof typeof RAMPS] ?? RAMPS.mainframe)[0];
  }
  return ramp?.[0] ?? RAMPS.mainframe[0];
};

/**
 * Braille and quadrants light a dot or leave it dark; blue-noise ordered
 * dithering keeps the bone's soft shading as a stipple.
 */
const packedDither = (look: AsciiLook): "none" | "blue-noise" => {
  const { kind } = resolveCharset(look.charset ?? "standard", look.chars);
  return kind === "braille" || kind === "quadrants" ? "blue-noise" : "none";
};

/** Ink, paper and map options for a look; phosphor and duotone bring their own glass. */
const sceneLook = (
  look: AsciiLook,
  theme: readonly (readonly number[])[] | null
) => {
  const transparent = look.background === "transparent";
  const themeInk = theme?.[0] ? toBytes(theme[0]) : ([230, 230, 230] as Rgb8);
  const themePaper = theme?.[1] ? toBytes(theme[1]) : ([10, 10, 10] as Rgb8);
  let ink: AsciiColor = "--ascii-ink";
  let paper: AsciiColor = "--ascii-paper";
  let palette: readonly Rgb8[] = [themePaper, themeInk];
  if (look.colorMode === "duotone") {
    paper = rampPaper(look.ramp);
    palette = [hexToRgb(paper), themeInk];
  } else if (look.phosphor && (look.colorMode ?? "mono") === "mono") {
    const preset = PHOSPHORS[look.phosphor];
    ({ ink } = preset);
    ({ paper } = preset);
    palette = [hexToRgb(preset.paper), hexToRgb(preset.ink)];
  }
  const options: MapOptions = {
    ansi: look.ansi,
    chars: look.chars,
    charset: look.charset,
    colorMode: look.colorMode,
    dither: look.dither ?? packedDither(look),
    edgeThreshold: look.edgeThreshold,
    grade: look.grade,
    invert: look.invert,
    palette,
    ramp: look.ramp,
    threshold: look.threshold,
  };
  // Phosphor and duotone glass is dark, so only the theme paper can be light.
  const lightPaper =
    paper === "--ascii-paper" &&
    (0.2126 * themePaper[0] + 0.7152 * themePaper[1] + 0.0722 * themePaper[2]) /
      255 >
      0.5;
  return {
    ink,
    lumaLimit: lightPaper ? 0.5 : 1,
    options,
    paper: transparent ? ("transparent" as const) : paper,
  };
};

/** On a light page, scale a colour down so its luma stays under `limit`. */
const capLuma = (rgb: [number, number, number], limit: number) => {
  const value = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  if (value > limit) {
    const scale = limit / value;
    rgb[0] *= scale;
    rgb[1] *= scale;
    rgb[2] *= scale;
  }
};

/* -------------------------------------------------------------------------- */
/* The mesh                                                                    */
/* -------------------------------------------------------------------------- */

// Model space: x to the skull's left, y up, and the face looks down -z,
// towards the camera. The cranium is a deformed shell around the origin.
const DEG = Math.PI / 180;
const LAT_STEPS = 30;
const LON_STEPS = 48;
const LAT_LOW = -52;
const LAT_HIGH = 90;
// The front of the shell below this latitude is left open; the upper jaw
// and teeth fill it.
const FACE_CUT = -30;
const FACE_CUT_WIDTH = 64;
// Rings and meridians drawn as wire: one in this many.
const WIRE_EVERY = 3;

/** Eye socket centre and half-size, in degrees on the shell. */
const SOCKET = { height: 13.5, lat: -2, lon: 28, width: 16 } as const;

const gauss = (x: number, width: number) => Math.exp(-((x / width) ** 2));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Polynomial smooth minimum, so the flattened face blends into the dome. */
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
};

/** Distance through an eye socket's ellipse: under 1 is inside. */
const socketDistance = (lat: number, lon: number, side: number) =>
  Math.hypot(
    (lon - side * SOCKET.lon) / SOCKET.width,
    (lat - SOCKET.lat) / SOCKET.height
  );

/** Distance through the pear-shaped nasal opening: under 1 is inside. */
const noseDistance = (lat: number, lon: number) => {
  const widen = Math.max(0, Math.min(1, (-12 - lat) / 18));
  return Math.hypot(lon / (4.5 + 4 * widen), (lat + 21) / 9.5);
};

const direction = (lat: number, lon: number) => {
  const cl = Math.cos(lat * DEG);
  return [
    cl * Math.sin(lon * DEG),
    Math.sin(lat * DEG),
    -cl * Math.cos(lon * DEG),
  ] as const;
};

/**
 * The cranium's radius in a direction, in degrees of latitude and of
 * longitude from the front, and how deep inside a cavity it sits (0 to 1).
 */
const cranium = (lat: number, lon: number): { r: number; cavity: number } => {
  const [dx, dy, dz] = direction(lat, lon);
  // A long, narrow ovoid: deeper behind than in front, lower under the brow.
  const ax = 0.73;
  const ay = dy > 0 ? 0.76 : 0.78;
  const az = dz < 0 ? 0.9 : 0.98;
  let r = 1 / Math.hypot(dx / ax, dy / ay, dz / az);
  const front = -dz;
  if (front > 0.05) {
    r = smin(r, 0.8 / front, 0.06);
  }
  const side = Math.abs(lon);
  r += 0.06 * gauss(lat - 10, 6) * gauss(lon, 45);
  r += 0.025 * gauss(lon, 6) * gauss(lat + 6, 8);
  r += 0.065 * gauss(side - 47, 13) * gauss(lat + 20, 8);
  r -= 0.045 * gauss(side - 80, 16) * gauss(lat - 2, 14);
  r += 0.03 * gauss(side - 180, 40) * gauss(lat + 12, 15);
  let cavity = 0;
  for (const s of [-1, 1]) {
    const e = socketDistance(lat, lon, s);
    r *= 1 - 0.42 * (1 - smoothstep(0.55, 1, e));
    r += 0.025 * gauss(e - 1.12, 0.18);
    cavity = Math.max(cavity, 1 - smoothstep(0.62, 1, e));
  }
  const nose = noseDistance(lat, lon);
  r *= 1 - 0.3 * (1 - smoothstep(0.55, 1, nose));
  cavity = Math.max(cavity, 1 - smoothstep(0.6, 1, nose));
  return { cavity, r };
};

/** A polyline drawn as wire, with points in model space. */
interface WireLine {
  points: number[];
  jaw: boolean;
  /** Drawn in `both` as well as `wire`. */
  feature: boolean;
}

interface Mesh {
  positions: Float32Array;
  normals: Float32Array;
  cavity: Float32Array;
  /** 1 for vertices that move with the jaw. */
  jaw: Uint8Array;
  triangles: Uint32Array;
  /** 0 bone, 1 teeth, per triangle. */
  material: Uint8Array;
  lines: readonly WireLine[];
  /** The bottoms of the eye sockets, where the eyes glow. */
  eyes: readonly (readonly [number, number, number])[];
}

class MeshBuilder {
  positions: number[] = [];
  cavity: number[] = [];
  jaw: number[] = [];
  triangles: number[] = [];
  material: number[] = [];
  lines: WireLine[] = [];

  vertex(x: number, y: number, z: number, cavity = 0, jaw = false): number {
    this.positions.push(x, y, z);
    this.cavity.push(cavity);
    this.jaw.push(jaw ? 1 : 0);
    return this.cavity.length - 1;
  }

  /** A triangle wound so its normal points away from `inside`. */
  triangle(
    a: number,
    b: number,
    c: number,
    inside: readonly number[],
    material = 0
  ): void {
    const p = this.positions;
    const ux = p[b * 3] - p[a * 3];
    const uy = p[b * 3 + 1] - p[a * 3 + 1];
    const uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3];
    const vy = p[c * 3 + 1] - p[a * 3 + 1];
    const vz = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const out =
      nx * ((p[a * 3] + p[b * 3] + p[c * 3]) / 3 - (inside[0] ?? 0)) +
      ny *
        ((p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3 - (inside[1] ?? 0)) +
      nz *
        ((p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3 - (inside[2] ?? 0));
    if (out >= 0) {
      this.triangles.push(a, b, c);
    } else {
      this.triangles.push(a, c, b);
    }
    this.material.push(material);
  }

  quad(
    a: number,
    b: number,
    c: number,
    d: number,
    inside: readonly number[],
    material = 0
  ): void {
    this.triangle(a, b, c, inside, material);
    this.triangle(a, c, d, inside, material);
  }

  line(points: number[], jaw: boolean, feature: boolean): void {
    if (points.length >= 6) {
      this.lines.push({ feature, jaw, points });
    }
  }
}

/** The cranium as a latitude and longitude shell, open at the lower face. */
// oxlint-disable-next-line complexity -- the shell, its open face and its wire are one grid walk.
const addCranium = (mesh: MeshBuilder) => {
  const index: number[][] = [];
  for (let i = 0; i <= LAT_STEPS; i += 1) {
    const lat = LAT_LOW + ((LAT_HIGH - LAT_LOW) * i) / LAT_STEPS;
    const row: number[] = [];
    if (i === LAT_STEPS) {
      const { r } = cranium(90, 0);
      const pole = mesh.vertex(0, r, 0);
      for (let j = 0; j < LON_STEPS; j += 1) {
        row.push(pole);
      }
    } else {
      for (let j = 0; j < LON_STEPS; j += 1) {
        const lon = -180 + (360 * j) / LON_STEPS;
        const { r, cavity } = cranium(lat, lon);
        const [dx, dy, dz] = direction(lat, lon);
        row.push(mesh.vertex(dx * r, dy * r, dz * r, cavity));
      }
    }
    index.push(row);
  }
  // Which quads exist, for the wire.
  const open = (i: number, j: number) => {
    const lat = LAT_LOW + ((LAT_HIGH - LAT_LOW) * (i + 0.5)) / LAT_STEPS;
    const lon = -180 + (360 * (j + 0.5)) / LON_STEPS;
    return lat < FACE_CUT && Math.abs(lon) < FACE_CUT_WIDTH;
  };
  for (let i = 0; i < LAT_STEPS; i += 1) {
    for (let j = 0; j < LON_STEPS; j += 1) {
      if (open(i, j)) {
        continue;
      }
      const k = (j + 1) % LON_STEPS;
      const a = index[i]?.[j] ?? 0;
      const b = index[i]?.[k] ?? 0;
      const c = index[i + 1]?.[k] ?? 0;
      const d = index[i + 1]?.[j] ?? 0;
      if (i + 1 === LAT_STEPS) {
        mesh.triangle(a, b, c, [0, 0, 0]);
      } else {
        mesh.quad(a, b, c, d, [0, 0, 0]);
      }
    }
  }
  // Every third ring and meridian of the shell, split where it is open.
  const at = (i: number, j: number) => {
    const v = index[i]?.[(j + LON_STEPS) % LON_STEPS] ?? 0;
    return [
      mesh.positions[v * 3] ?? 0,
      mesh.positions[v * 3 + 1] ?? 0,
      mesh.positions[v * 3 + 2] ?? 0,
    ];
  };
  for (let i = WIRE_EVERY; i < LAT_STEPS; i += WIRE_EVERY) {
    let run: number[] = [];
    for (let j = 0; j <= LON_STEPS; j += 1) {
      const solid = !(open(i, j % LON_STEPS) && open(i - 1, j % LON_STEPS));
      if (solid) {
        run.push(...at(i, j));
      } else {
        mesh.line(run, false, false);
        run = [];
      }
    }
    mesh.line(run, false, false);
  }
  for (let j = 0; j < LON_STEPS; j += WIRE_EVERY) {
    let run: number[] = [];
    for (let i = 0; i <= LAT_STEPS; i += 1) {
      const solid =
        i === LAT_STEPS ||
        !(open(i, j) && open(i, (j + LON_STEPS - 1) % LON_STEPS));
      if (solid) {
        run.push(...at(i, j));
      } else {
        mesh.line(run, false, false);
        run = [];
      }
    }
    mesh.line(run, false, false);
  }
};

/** Outlines of the eye sockets and the nasal opening, traced on the shell. */
const addFeatureLines = (mesh: MeshBuilder) => {
  const trace = (point: (t: number) => readonly [number, number]) => {
    const points: number[] = [];
    for (let step = 0; step <= 40; step += 1) {
      const [lat, lon] = point((step / 40) * Math.PI * 2);
      // Lifted off the shell a little: flat faces span the hollows above
      // the true surface and would otherwise hide the line.
      const r = cranium(lat, lon).r + 0.03;
      const [dx, dy, dz] = direction(lat, lon);
      points.push(dx * r, dy * r, dz * r);
    }
    mesh.line(points, false, true);
  };
  for (const side of [-1, 1]) {
    trace((t) => [
      SOCKET.lat + SOCKET.height * 0.92 * Math.sin(t),
      side * SOCKET.lon + SOCKET.width * 0.92 * Math.cos(t),
    ]);
  }
  trace((t) => {
    const lat = -21 + 9.5 * 0.9 * Math.sin(t);
    const widen = Math.max(0, Math.min(1, (-12 - lat) / 18));
    return [lat, (4.5 + 4 * widen) * 0.9 * Math.cos(t)];
  });
};

type Vec3 = readonly [number, number, number];

/**
 * A bar swept along a path: at each point, a cross-section spanning
 * `width` (from the path point) by `thickness` across it.
 */
// oxlint-disable-next-line complexity -- rings, faces, caps and edge lines share one path walk.
const addSweep = (
  mesh: MeshBuilder,
  path: readonly Vec3[],
  width: (index: number) => Vec3,
  thickness: number,
  jaw: boolean
) => {
  const rings: (readonly number[])[] = [];
  const centres: Vec3[] = [];
  for (const [k, p] of path.entries()) {
    const prev = path[Math.max(0, k - 1)] ?? p;
    const next = path[Math.min(path.length - 1, k + 1)] ?? p;
    const t = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
    const w = width(k);
    let nx = t[1] * w[2] - t[2] * w[1];
    let ny = t[2] * w[0] - t[0] * w[2];
    let nz = t[0] * w[1] - t[1] * w[0];
    const length = Math.hypot(nx, ny, nz) || 1;
    nx = (nx / length) * thickness * 0.5;
    ny = (ny / length) * thickness * 0.5;
    nz = (nz / length) * thickness * 0.5;
    rings.push([
      mesh.vertex(p[0] + nx, p[1] + ny, p[2] + nz, 0, jaw),
      mesh.vertex(p[0] + w[0] + nx, p[1] + w[1] + ny, p[2] + w[2] + nz, 0, jaw),
      mesh.vertex(p[0] + w[0] - nx, p[1] + w[1] - ny, p[2] + w[2] - nz, 0, jaw),
      mesh.vertex(p[0] - nx, p[1] - ny, p[2] - nz, 0, jaw),
    ]);
    centres.push([p[0] + w[0] / 2, p[1] + w[1] / 2, p[2] + w[2] / 2]);
  }
  for (let k = 0; k + 1 < rings.length; k += 1) {
    const a = rings[k] ?? [];
    const b = rings[k + 1] ?? [];
    const ca = centres[k] ?? [0, 0, 0];
    const cb = centres[k + 1] ?? [0, 0, 0];
    const inside = [
      (ca[0] + cb[0]) / 2,
      (ca[1] + cb[1]) / 2,
      (ca[2] + cb[2]) / 2,
    ];
    for (let side = 0; side < 4; side += 1) {
      const s = (side + 1) % 4;
      mesh.quad(a[side] ?? 0, a[s] ?? 0, b[s] ?? 0, b[side] ?? 0, inside);
    }
  }
  for (const [k, ring] of [
    [0, rings[0]],
    [rings.length - 1, rings.at(-1)],
  ] as const) {
    if (ring) {
      mesh.quad(
        ring[0] ?? 0,
        ring[1] ?? 0,
        ring[2] ?? 0,
        ring[3] ?? 0,
        centres[k === 0 ? 1 : rings.length - 2] ?? [0, 0, 0]
      );
    }
  }
  // The outer face's two long edges.
  for (const corner of [0, 1]) {
    const points: number[] = [];
    for (const ring of rings) {
      const v = ring[corner] ?? 0;
      points.push(
        mesh.positions[v * 3] ?? 0,
        mesh.positions[v * 3 + 1] ?? 0,
        mesh.positions[v * 3 + 2] ?? 0
      );
    }
    mesh.line(points, jaw, true);
  }
};

/** A box from its centre and three half-axes. */
const addBox = (
  mesh: MeshBuilder,
  c: Vec3,
  u: Vec3,
  v: Vec3,
  n: Vec3,
  jaw: boolean
) => {
  const corner = (a: number, b: number, d: number) =>
    mesh.vertex(
      c[0] + a * u[0] + b * v[0] + d * n[0],
      c[1] + a * u[1] + b * v[1] + d * n[1],
      c[2] + a * u[2] + b * v[2] + d * n[2],
      0,
      jaw
    );
  const k = [
    corner(-1, -1, -1),
    corner(1, -1, -1),
    corner(1, 1, -1),
    corner(-1, 1, -1),
    corner(-1, -1, 1),
    corner(1, -1, 1),
    corner(1, 1, 1),
    corner(-1, 1, 1),
  ];
  const faces = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [3, 2, 6, 7],
    [0, 3, 7, 4],
    [1, 2, 6, 5],
  ];
  for (const [a, b, d, e] of faces) {
    mesh.quad(
      k[a ?? 0] ?? 0,
      k[b ?? 0] ?? 0,
      k[d ?? 0] ?? 0,
      k[e ?? 0] ?? 0,
      c,
      1
    );
  }
};

/** Points on a dental arch: half-width `x`, front at `front`, back at `back`. */
const arch = (
  t: number,
  x: number,
  back: number,
  front: number,
  y: number
): Vec3 => [x * Math.sin(t), y, -(back + (front - back) * Math.cos(t))];

/** One row of teeth along an arch, with a wire line between each pair. */
const addTeeth = (
  mesh: MeshBuilder,
  {
    x,
    back,
    front,
    top,
    height,
    count,
    spread,
    jaw,
  }: {
    x: number;
    back: number;
    front: number;
    top: number;
    height: number;
    count: number;
    spread: number;
    jaw: boolean;
  }
) => {
  const bite: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (((i + 0.5) / count) * 2 - 1) * spread;
    const step = ((2 * spread) / count) * 0.5;
    const a = arch(t - step, x, back, front, 0);
    const b = arch(t + step, x, back, front, 0);
    const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const tx = (b[0] - a[0]) / span;
    const tz = (b[2] - a[2]) / span;
    // Back teeth are squatter and deeper.
    const molar = smoothstep(0.45, 0.85, Math.abs(t) / spread);
    const h = height * (1 - 0.25 * molar);
    const depth = 0.035 + 0.025 * molar;
    const centre = arch(t, x, back, front, top - h / 2);
    addBox(
      mesh,
      centre,
      [tx * span * 0.41, 0, tz * span * 0.41],
      [0, h / 2, 0],
      [-tz * depth, 0, tx * depth],
      jaw
    );
    const edge = top - h * (jaw ? 0 : 1);
    bite.push(centre[0], edge, centre[2]);
    if (i > 0) {
      const gap = arch(t - step, x, back, front, 0);
      mesh.line([gap[0], top, gap[2], gap[0], top - h, gap[2]], jaw, true);
    }
  }
  mesh.line(bite, jaw, true);
};

const HINGE = [0, -0.27, 0.03] as const;

const buildMesh = (): Mesh => {
  const mesh = new MeshBuilder();
  addCranium(mesh);
  addFeatureLines(mesh);
  // Upper jaw: a band along the dental arch that tucks under the cheeks.
  const upper: Vec3[] = [];
  for (let k = 0; k <= 12; k += 1) {
    upper.push(arch(((k / 12) * 2 - 1) * 100 * DEG, 0.37, 0.22, 0.79, -0.34));
  }
  addSweep(mesh, upper, () => [0, -0.15, 0], 0.07, false);
  addTeeth(mesh, {
    back: 0.25,
    count: 12,
    front: 0.77,
    height: 0.11,
    jaw: false,
    spread: 78 * DEG,
    top: -0.48,
    x: 0.33,
  });
  // Lower jaw: the body of the mandible along the arch, then a plate up
  // each side to the hinge below the ear.
  const body: Vec3[] = [];
  for (let k = 0; k <= 14; k += 1) {
    const t = ((k / 14) * 2 - 1) * 100 * DEG;
    const [x, , z] = arch(t, 0.4, 0.2, 0.78, 0);
    body.push([x, -0.93 + 0.12 * (1 - Math.cos(t)), z]);
  }
  addSweep(
    mesh,
    body,
    (k) => [0, 0.26 - 0.05 * Math.abs(k / 7 - 1), 0],
    0.075,
    true
  );
  for (const side of [-1, 1]) {
    const gonion = body[side < 0 ? 0 : body.length - 1] ?? [0, 0, 0];
    const ramus: Vec3[] = [];
    for (let k = 0; k <= 4; k += 1) {
      const t = k / 4;
      ramus.push([
        gonion[0] + (side * 0.5 - gonion[0]) * t,
        gonion[1] + (-0.26 - gonion[1]) * t,
        gonion[2] + (0.03 - gonion[2]) * t + 0.04,
      ]);
    }
    addSweep(mesh, ramus, (k) => [0, 0, -0.2 + 0.02 * k], 0.06, true);
  }
  addTeeth(mesh, {
    back: 0.27,
    count: 12,
    front: 0.74,
    height: 0.095,
    jaw: true,
    spread: 74 * DEG,
    top: -0.6,
    x: 0.31,
  });

  // Smooth normals: area-weighted face normals summed per vertex.
  const positions = new Float32Array(mesh.positions);
  const normals = new Float32Array(positions.length);
  const { triangles } = mesh;
  for (let t = 0; t < triangles.length; t += 3) {
    const a = (triangles[t] ?? 0) * 3;
    const b = (triangles[t + 1] ?? 0) * 3;
    const c = (triangles[t + 2] ?? 0) * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const length = Math.hypot(normals[v], normals[v + 1], normals[v + 2]) || 1;
    normals[v] /= length;
    normals[v + 1] /= length;
    normals[v + 2] /= length;
  }
  const eyes = [-1, 1].map((side): Vec3 => {
    const { r } = cranium(SOCKET.lat, side * SOCKET.lon);
    const [dx, dy, dz] = direction(SOCKET.lat, side * SOCKET.lon);
    return [dx * (r + 0.03), dy * (r + 0.03), dz * (r + 0.03)];
  });
  return {
    cavity: new Float32Array(mesh.cavity),
    eyes,
    jaw: new Uint8Array(mesh.jaw),
    lines: mesh.lines,
    material: new Uint8Array(mesh.material),
    normals,
    positions,
    triangles: new Uint32Array(triangles),
  };
};

let sharedMesh: Mesh | null = null;
const skullMesh = (): Mesh => {
  sharedMesh ??= buildMesh();
  return sharedMesh;
};

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

// The camera sits CAMERA units in front of the skull's centre.
const CAMERA = 6;
const CENTRE = [0, -0.06, 0.08] as const;
const MAX_PITCH = 0.9;
const REST_PITCH = 0.08;
// Wire points within this distance of the visible surface count as visible.
const WIRE_BIAS = 0.05;

const LIGHT = (() => {
  const length = Math.hypot(-0.5, 0.55, -0.67);
  return [-0.5 / length, 0.55 / length, -0.67 / length] as const;
})();
const HALF = (() => {
  const [x, y, z] = LIGHT;
  const length = Math.hypot(x, y, z - 1);
  return [x / length, y / length, (z - 1) / length] as const;
})();

/** Per-frame view-space copies of the mesh. */
interface View {
  /** Camera distance, then screen x and y in CSS pixels, per vertex. */
  depth: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  /** View-space position and normal per vertex. */
  position: Float32Array;
  normal: Float32Array;
}

interface Pose {
  m: Float64Array;
  /** Jaw rotation around the hinge, radians. */
  jaw: number;
  unit: number;
  cx: number;
  cy: number;
}

/** Model point to view space: jaw hinge, recentre, rotate. */
const toView = (
  pose: Pose,
  x: number,
  y: number,
  z: number,
  jaw: boolean,
  out: Float64Array
) => {
  let px = x;
  let py = y;
  let pz = z;
  if (jaw && pose.jaw !== 0) {
    const c = Math.cos(pose.jaw);
    const s = Math.sin(pose.jaw);
    const ry = py - HINGE[1];
    const rz = pz - HINGE[2];
    py = HINGE[1] + ry * c - rz * s;
    pz = HINGE[2] + ry * s + rz * c;
  }
  px -= CENTRE[0];
  py -= CENTRE[1];
  pz -= CENTRE[2];
  const { m } = pose;
  out[0] = m[0] * px + m[1] * py + m[2] * pz;
  out[1] = m[3] * px + m[4] * py + m[5] * pz;
  out[2] = m[6] * px + m[7] * py + m[8] * pz;
  const distance = CAMERA + out[2];
  const scale = (pose.unit * CAMERA) / distance;
  out[3] = distance;
  out[4] = pose.cx + out[0] * scale;
  out[5] = pose.cy - out[1] * scale;
};

const scratch = new Float64Array(6);

const transformMesh = (mesh: Mesh, pose: Pose, view: View) => {
  const { positions, normals, jaw } = mesh;
  const { m } = pose;
  const c = Math.cos(pose.jaw);
  const s = Math.sin(pose.jaw);
  for (let v = 0; v < jaw.length; v += 1) {
    const i = v * 3;
    const moves = jaw[v] === 1;
    toView(
      pose,
      positions[i],
      positions[i + 1],
      positions[i + 2],
      moves,
      scratch
    );
    const [x, y, z, distance, sx, sy] = scratch;
    view.position[i] = x;
    view.position[i + 1] = y;
    view.position[i + 2] = z;
    view.depth[v] = distance;
    view.sx[v] = sx;
    view.sy[v] = sy;
    const nx = normals[i];
    let ny = normals[i + 1];
    let nz = normals[i + 2];
    if (moves) {
      const ty = ny * c - nz * s;
      nz = ny * s + nz * c;
      ny = ty;
    }
    view.normal[i] = m[0] * nx + m[1] * ny + m[2] * nz;
    view.normal[i + 1] = m[3] * nx + m[4] * ny + m[5] * nz;
    view.normal[i + 2] = m[6] * nx + m[7] * ny + m[8] * nz;
  }
};

interface Raster {
  field: ToneField;
  depth: Float32Array;
  sampleWidth: number;
  sampleHeight: number;
  smooth: boolean;
  /** Draw lit faces, or depth only (for the wire). */
  solid: boolean;
  bone: Rgb8;
  accent: Rgb8;
  lumaLimit: number;
  /** Model-space height of the scan band, or NaN for none. */
  scan: number;
}

/** Reused colour scratch, so shading allocates nothing per sample. */
const mix: [number, number, number] = [0, 0, 0];

/**
 * Fill every triangle into the depth buffer, and when solid, shade the
 * samples it wins. Faces turned away from the camera are the inside of
 * the bone, seen through the sockets and the open jaw, and stay dark.
 */
// oxlint-disable-next-line complexity -- one tight loop over every sample of every face.
const rasterize = (mesh: Mesh, view: View, raster: Raster) => {
  const { triangles, cavity, material, positions } = mesh;
  const { field, depth, sampleWidth, sampleHeight } = raster;
  const { tones, colors, width, height } = field;
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t];
    const b = triangles[t + 1];
    const c = triangles[t + 2];
    const ax = view.sx[a] / sampleWidth;
    const ay = view.sy[a] / sampleHeight;
    const bx = view.sx[b] / sampleWidth;
    const by = view.sy[b] / sampleHeight;
    const cx = view.sx[c] / sampleWidth;
    const cy = view.sy[c] / sampleHeight;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-6) {
      continue;
    }
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x0 > x1 || y0 > y1) {
      continue;
    }
    // Face normal in view space, pointing out of the bone.
    const pa = a * 3;
    const pb = b * 3;
    const pc = c * 3;
    const ux = view.position[pb] - view.position[pa];
    const uy = view.position[pb + 1] - view.position[pa + 1];
    const uz = view.position[pb + 2] - view.position[pa + 2];
    const vx = view.position[pc] - view.position[pa];
    const vy = view.position[pc + 1] - view.position[pa + 1];
    const vz = view.position[pc + 2] - view.position[pa + 2];
    let fx = uy * vz - uz * vy;
    let fy = uz * vx - ux * vz;
    let fz = ux * vy - uy * vx;
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl;
    fy /= fl;
    fz /= fl;
    const front =
      fx * view.position[pa] +
        fy * view.position[pa + 1] +
        fz * (view.position[pa + 2] + CAMERA) <
      0;
    const teeth = material[t / 3] === 1;
    const inverse = 1 / area;
    for (let sy = y0; sy <= y1; sy += 1) {
      const py = sy + 0.5;
      for (let sx = x0; sx <= x1; sx += 1) {
        const px = sx + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inverse;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inverse;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) {
          continue;
        }
        const at = sy * width + sx;
        const d = w0 * view.depth[a] + w1 * view.depth[b] + w2 * view.depth[c];
        if (d >= depth[at]) {
          continue;
        }
        depth[at] = d;
        if (!raster.solid) {
          continue;
        }
        if (!front) {
          tones[at] = 0.04;
          if (colors) {
            const k = at * 4;
            colors[k] = raster.bone[0] * 0.1;
            colors[k + 1] = raster.bone[1] * 0.1;
            colors[k + 2] = raster.bone[2] * 0.1;
            colors[k + 3] = 255;
          }
          continue;
        }
        let nx = fx;
        let ny = fy;
        let nz = fz;
        if (raster.smooth) {
          nx =
            w0 * view.normal[pa] + w1 * view.normal[pb] + w2 * view.normal[pc];
          ny =
            w0 * view.normal[pa + 1] +
            w1 * view.normal[pb + 1] +
            w2 * view.normal[pc + 1];
          nz =
            w0 * view.normal[pa + 2] +
            w1 * view.normal[pb + 2] +
            w2 * view.normal[pc + 2];
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl;
          ny /= nl;
          nz /= nl;
        }
        const hollow = w0 * cavity[a] + w1 * cavity[b] + w2 * cavity[c];
        const diffuse = Math.max(
          0,
          nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
        );
        const specular =
          Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]) ** 24;
        const rim = (1 - Math.min(1, Math.max(0, -nz))) ** 2.5 * (1 - hollow);
        const shade = 1 - 0.9 * hollow;
        let band = 0;
        if (!Number.isNaN(raster.scan)) {
          const y =
            w0 * positions[pa + 1] +
            w1 * positions[pb + 1] +
            w2 * positions[pc + 1];
          const offset = y - raster.scan;
          // A sharp leading edge and a short fading trail above it.
          band =
            gauss(offset, 0.035) +
            (offset > 0 ? 0.35 * Math.exp(-offset / 0.12) : 0);
        }
        const lit =
          (0.12 + 0.74 * diffuse + (teeth ? 0.1 : 0)) * shade + 0.35 * specular;
        tones[at] = Math.min(1, lit + 0.28 * rim + 0.45 * band);
        if (colors) {
          const body = (0.2 + 0.85 * diffuse + (teeth ? 0.1 : 0)) * shade;
          const glow = 0.75 * rim + 0.9 * band;
          const shine = specular * 140;
          mix[0] = raster.bone[0] * body + raster.accent[0] * glow + shine;
          mix[1] = raster.bone[1] * body + raster.accent[1] * glow + shine;
          mix[2] = raster.bone[2] * body + raster.accent[2] * glow + shine;
          if (raster.lumaLimit < 1) {
            capLuma(mix, raster.lumaLimit);
          }
          colors.set(mix, at * 4);
          colors[at * 4 + 3] = 255;
        }
      }
    }
  }
};

/** A glowing sphere at a view-space point, depth tested like the mesh. */
const drawEye = (
  raster: Raster,
  pose: Pose,
  point: Vec3,
  radius: number,
  strength: number
) => {
  toView(pose, point[0], point[1], point[2], false, scratch);
  const { 3: distance, 4: px, 5: py } = scratch;
  const scale = (pose.unit * CAMERA) / distance;
  const rs = radius * scale * 2.4;
  const { field, depth, sampleWidth, sampleHeight } = raster;
  const x0 = Math.max(0, Math.floor((px - rs) / sampleWidth));
  const x1 = Math.min(field.width - 1, Math.ceil((px + rs) / sampleWidth));
  const y0 = Math.max(0, Math.floor((py - rs) / sampleHeight));
  const y1 = Math.min(field.height - 1, Math.ceil((py + rs) / sampleHeight));
  for (let sy = y0; sy <= y1; sy += 1) {
    for (let sx = x0; sx <= x1; sx += 1) {
      const dx = ((sx + 0.5) * sampleWidth - px) / rs;
      const dy = ((sy + 0.5) * sampleHeight - py) / rs;
      const q = dx * dx + dy * dy;
      const at = sy * field.width + sx;
      // Only where the socket itself is the nearest surface.
      if (q >= 1 || distance - radius > depth[at] + 0.02) {
        continue;
      }
      const glow = strength * (1 - q) ** 1.5;
      field.tones[at] = Math.max(field.tones[at], Math.min(1, glow * 1.3));
      if (field.colors) {
        const k = at * 4;
        const core = Math.min(1, glow * 1.4);
        mix[0] = raster.accent[0] * core + 255 * core * core * 0.35;
        mix[1] = raster.accent[1] * core + 255 * core * core * 0.35;
        mix[2] = raster.accent[2] * core + 255 * core * core * 0.35;
        if (raster.lumaLimit < 1) {
          capLuma(mix, raster.lumaLimit);
        }
        field.colors[k] = Math.max(field.colors[k], mix[0]);
        field.colors[k + 1] = Math.max(field.colors[k + 1], mix[1]);
        field.colors[k + 2] = Math.max(field.colors[k + 2], mix[2]);
        field.colors[k + 3] = 255;
      }
    }
  }
};

/** Where a wire point lands, and whether the mesh hides it. */
const wirePoint = (raster: Raster, x: number, y: number, distance: number) => {
  const sx = Math.floor(x / raster.sampleWidth);
  const sy = Math.floor(y / raster.sampleHeight);
  if (
    sx < 0 ||
    sy < 0 ||
    sx >= raster.field.width ||
    sy >= raster.field.height
  ) {
    return -1;
  }
  const at = sy * raster.field.width + sx;
  return distance <= raster.depth[at] + WIRE_BIAS ? at : -1;
};

/**
 * The glyph for a line running (dx, dy) on screen, y down: `-`, `\`,
 * `|` or `/`, snapped to the nearest 45 degrees.
 */
const lineGlyph = (dx: number, dy: number) => {
  let angle = Math.atan2(dy, dx);
  if (angle < 0) {
    angle += Math.PI;
  }
  return "-\\|/"[Math.round(angle / (Math.PI / 4)) % 4] ?? "-";
};

interface WirePass {
  raster: Raster;
  pose: Pose;
  frame: MutableFrame;
  cellWidth: number;
  cellHeight: number;
  /** Packed charsets draw lines as lit samples instead of edge glyphs. */
  packed: boolean;
  /** Colour for the edge glyphs, or undefined for plain ink. */
  rgb: Rgb8 | undefined;
  /** Colour for the shell's grid lines, which sit behind the features. */
  faint: Rgb8 | undefined;
  features: boolean;
}

const start = new Float64Array(6);
const end = new Float64Array(6);

/** Visible mesh edges, as edge glyphs per cell or lit samples. */
const drawWire = (mesh: Mesh, pass: WirePass) => {
  const { raster, pose, frame, cellWidth, cellHeight, packed } = pass;
  const step = packed
    ? Math.min(raster.sampleWidth, raster.sampleHeight) * 0.7
    : Math.min(cellWidth, cellHeight) * 0.5;
  for (const line of mesh.lines) {
    if (pass.features && !line.feature) {
      continue;
    }
    const { points } = line;
    for (let p = 0; p + 5 < points.length; p += 3) {
      toView(
        pose,
        points[p] ?? 0,
        points[p + 1] ?? 0,
        points[p + 2] ?? 0,
        line.jaw,
        start
      );
      toView(
        pose,
        points[p + 3] ?? 0,
        points[p + 4] ?? 0,
        points[p + 5] ?? 0,
        line.jaw,
        end
      );
      const dx = end[4] - start[4];
      const dy = end[5] - start[5];
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
      const glyph = lineGlyph(dx, dy);
      const rgb = line.feature ? pass.rgb : pass.faint;
      for (let s = 0; s <= steps; s += 1) {
        const f = s / steps;
        const x = start[4] + dx * f;
        const y = start[5] + dy * f;
        const at = wirePoint(raster, x, y, start[3] + (end[3] - start[3]) * f);
        if (at < 0) {
          continue;
        }
        if (packed) {
          raster.field.tones[at] = 1;
          if (raster.field.colors && rgb) {
            raster.field.colors.set([...rgb, 255], at * 4);
          }
        } else {
          frame.put(
            Math.floor(x / cellWidth),
            Math.floor(y / cellHeight),
            glyph,
            rgb
          );
        }
      }
    }
  }
};

/**
 * The outline of whatever the mesh covers, for the wire alone: lit
 * samples along the edge in packed charsets, edge glyphs otherwise.
 */
const drawOutline = (pass: WirePass, columns: number, rows: number) => {
  const { raster, frame, packed } = pass;
  const { field, depth } = raster;
  const { width, height } = field;
  const covered = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    depth[y * width + x] < Number.POSITIVE_INFINITY;
  if (packed) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (
          covered(x, y) &&
          !(
            covered(x - 1, y) &&
            covered(x + 1, y) &&
            covered(x, y - 1) &&
            covered(x, y + 1)
          )
        ) {
          const at = y * width + x;
          field.tones[at] = 1;
          if (field.colors && pass.rgb) {
            field.colors.set([...pass.rgb, 255], at * 4);
          }
        }
      }
    }
    return;
  }
  const gx = width / columns;
  const gy = height / rows;
  const coverage = new Float32Array(columns * rows);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (covered(x, y)) {
        coverage[Math.floor(y / gy) * columns + Math.floor(x / gx)] +=
          1 / (gx * gy);
      }
    }
  }
  const at = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < columns && y < rows ? coverage[y * columns + x] : 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      // Only the outermost covered cells, so the outline is one glyph wide.
      if (
        at(x, y) <= 0 ||
        Math.min(at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)) >= 1
      ) {
        continue;
      }
      // Sobel on coverage, in pixels so tall cells don't skew the angle.
      const sx =
        (at(x + 1, y - 1) +
          2 * at(x + 1, y) +
          at(x + 1, y + 1) -
          at(x - 1, y - 1) -
          2 * at(x - 1, y) -
          at(x - 1, y + 1)) /
        pass.cellWidth;
      const sy =
        (at(x - 1, y + 1) +
          2 * at(x, y + 1) +
          at(x + 1, y + 1) -
          at(x - 1, y - 1) -
          2 * at(x, y - 1) -
          at(x + 1, y - 1)) /
        pass.cellHeight;
      if (Math.hypot(sx * pass.cellWidth, sy * pass.cellHeight) > 0.9) {
        frame.put(x, y, edgeChar(sx, sy), pass.rgb);
      }
    }
  }
};

/** Object-to-view rotation: yaw around y, then pitch around x. */
const rotation = (yaw: number, pitch: number, into: Float64Array) => {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // Rx(pitch) * Ry(yaw), row-major.
  into.set([cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy]);
};

/* -------------------------------------------------------------------------- */
/* Drag to turn                                                                */
/* -------------------------------------------------------------------------- */

interface Turn {
  yaw: number;
  pitch: number;
  /** Extra yaw velocity from a drag, decaying back to 0. */
  velocity: number;
  dragging: boolean;
}

const clampPitch = (pitch: number) =>
  Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));

/** A sideways drag turns the skull, an up and down drag nods it. */
const useDragTurn = (
  ref: RefObject<HTMLDivElement | null>,
  turn: RefObject<Turn>,
  enabled: boolean
) => {
  useEffect(() => {
    const root = ref.current;
    if (!(root && enabled)) {
      return;
    }
    let last = { t: 0, x: 0, y: 0 };
    const down = (event: PointerEvent) => {
      turn.current.dragging = true;
      turn.current.velocity = 0;
      last = { t: event.timeStamp, x: event.clientX, y: event.clientY };
      root.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!turn.current.dragging) {
        return;
      }
      const size = Math.max(120, Math.min(root.clientWidth, root.clientHeight));
      const dx = ((event.clientX - last.x) / size) * Math.PI;
      const dy = ((event.clientY - last.y) / size) * Math.PI;
      const dt = Math.max(1, event.timeStamp - last.t) / 1000;
      turn.current.yaw -= dx;
      turn.current.pitch = clampPitch(turn.current.pitch - dy);
      turn.current.velocity = -dx / dt;
      last = { t: event.timeStamp, x: event.clientX, y: event.clientY };
    };
    const up = () => {
      turn.current.dragging = false;
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    return () => {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
    };
  }, [ref, turn, enabled]);
};

const KEYS: Partial<Record<string, readonly [number, number]>> = {
  ArrowDown: [0, -0.15],
  ArrowLeft: [0.2, 0],
  ArrowRight: [-0.2, 0],
  ArrowUp: [0, 0.15],
};

const DEFAULT_BONE = [225, 225, 220] as const satisfies Rgb8;
const DEFAULT_ACCENT = [90, 170, 255] as const satisfies Rgb8;

/** How far the jaw hangs open at time `t`: a slow open and close now and then, then rest. */
const jawAngle = (t: number) =>
  -0.24 *
  (0.5 - 0.5 * Math.cos(t * 1.3)) *
  smoothstep(-0.2, 0.6, Math.sin(t * 0.4));

/**
 * A low-poly skull drawn in glyphs on the CPU. The mesh is built in code:
 * a shell for the cranium with sunken eye sockets and nasal opening,
 * cheekbones and a brow ridge, an upper jaw and a hinged mandible, each
 * with a row of teeth. Faces go through a depth buffer and are lit to
 * glyph tones; visible edges can be drawn over them in edge glyphs.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const CyberSkull = ({
  shading = "both",
  surface = "faceted",
  speed = 0.3,
  jaw = true,
  scan = true,
  eyes = true,
  color: boneColor = "--ascii-ink",
  accent = "blue",
  interactive = true,
  cell = 10,
  animate = true,
  handle,
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
  background,
  fx,
  className,
  "aria-label": ariaLabel,
  ...props
}: CyberSkullProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useAsciiColors(rootRef, [
    "--ascii-ink",
    "--ascii-paper",
    boneColor,
    accent,
  ]);
  const reducedMotion = usePrefersReducedMotion();
  const turnRef = useRef<Turn>({
    dragging: false,
    pitch: REST_PITCH,
    velocity: 0,
    yaw: 0.5,
  });
  useDragTurn(rootRef, turnRef, interactive);
  const fieldRef = useRef<ToneField | null>(null);
  const depthRef = useRef(new Float32Array(0));
  const viewRef = useRef<View | null>(null);
  const matrix = useRef(new Float64Array(9));

  const look: AsciiLook = {
    ansi,
    background,
    chars,
    charset,
    colorMode,
    dither,
    edgeThreshold,
    grade,
    invert,
    phosphor,
    ramp,
    threshold,
  };
  const { ink, paper, options, lumaLimit } = sceneLook(look, theme);
  const resolved = resolveCharset(charset, chars);
  const packed = resolved.kind === "braille" || resolved.kind === "quadrants";
  const bone = theme?.[2] ? toBytes(theme[2]) : DEFAULT_BONE;
  let accentRgb: Rgb8 = theme?.[3] ? toBytes(theme[3]) : DEFAULT_ACCENT;
  if (lumaLimit < 1) {
    const capped: [number, number, number] = [...accentRgb];
    capLuma(capped, lumaLimit);
    accentRgb = capped;
  }

  // oxlint-disable-next-line complexity -- one branch per shading and charset path.
  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    delta,
    time,
  }: AsciiGridDrawContext) => {
    const mesh = skullMesh();
    const state = turnRef.current;
    if (delta > 0) {
      if (!state.dragging) {
        state.yaw += (speed + state.velocity) * delta;
        state.velocity *= Math.exp(-delta * 1.4);
      }
    } else if (!(animate && !reducedMotion) && !state.dragging) {
      state.yaw = 0.5 + speed * time;
    }

    let field = fieldRef.current;
    const [gx, gy] = resolved.grid;
    if (!field || field.width !== columns * gx || field.height !== rows * gy) {
      field = createToneField(columns, rows, resolved, { color: true });
      fieldRef.current = field;
      depthRef.current = new Float32Array(field.width * field.height);
    }
    const vertices = mesh.jaw.length;
    let view = viewRef.current;
    if (!view || view.depth.length !== vertices) {
      view = {
        depth: new Float32Array(vertices),
        normal: new Float32Array(vertices * 3),
        position: new Float32Array(vertices * 3),
        sx: new Float32Array(vertices),
        sy: new Float32Array(vertices),
      };
      viewRef.current = view;
    }
    field.tones.fill(0);
    field.colors?.fill(0);
    depthRef.current.fill(Number.POSITIVE_INFINITY);

    const width = columns * metrics.width;
    const height = rows * metrics.height;
    // The skull is about 1.8 units tall; the margin leaves room for the near
    // side, which perspective draws larger.
    const unit = Math.max(4, Math.min(height * 0.4, width * 0.42));
    // A slow nod keeps the skull alive between drags.
    const pitch = clampPitch(state.pitch + 0.05 * Math.sin(time * 0.4));
    rotation(state.yaw, pitch, matrix.current);
    const pose: Pose = {
      cx: width / 2,
      cy: height / 2,
      jaw: jaw ? jawAngle(time) : 0,
      m: matrix.current,
      unit,
    };
    transformMesh(mesh, pose, view);
    // The band falls slowly from the crown to below the chin, then rests
    // for most of the cycle.
    const sweep = (time / 8) % 1;
    const raster: Raster = {
      accent: accentRgb,
      bone,
      depth: depthRef.current,
      field,
      lumaLimit,
      sampleHeight: metrics.height / gy,
      sampleWidth: metrics.width / gx,
      scan: scan && shading !== "wire" ? 0.95 - sweep * 2.6 : Number.NaN,
      smooth: surface === "smooth",
      solid: shading !== "wire",
    };
    rasterize(mesh, view, raster);
    if (eyes) {
      const pulse = 0.85 + 0.15 * Math.sin(time * 0.9);
      for (const eye of mesh.eyes) {
        drawEye(raster, pose, eye, 0.07, pulse);
      }
    }
    const pass: WirePass = {
      cellHeight: metrics.height,
      cellWidth: metrics.width,
      faint:
        colorMode === "mono"
          ? undefined
          : [accentRgb[0] * 0.5, accentRgb[1] * 0.5, accentRgb[2] * 0.5],
      features: shading === "both",
      frame,
      packed,
      pose,
      raster,
      rgb: colorMode === "mono" ? undefined : accentRgb,
    };
    if (packed && shading !== "solid") {
      drawWire(mesh, pass);
      if (shading === "wire") {
        drawOutline(pass, columns, rows);
      }
    }
    mapTones(field, columns, rows, options, frame);
    if (!packed && shading !== "solid") {
      drawWire(mesh, pass);
      if (shading === "wire") {
        drawOutline(pass, columns, rows);
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEYS[event.key];
    if (!(interactive && step)) {
      return;
    }
    event.preventDefault();
    turnRef.current.yaw += step[0];
    turnRef.current.pitch = clampPitch(turnRef.current.pitch + step[1]);
  };

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={
        ariaLabel ??
        (interactive
          ? "A turning skull drawn in glyphs. Drag it or use the arrow keys to turn it."
          : "A turning skull drawn in glyphs.")
      }
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={onKeyDown}
      className={cn(
        "relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring",
        interactive && "cursor-grab touch-pan-y active:cursor-grabbing",
        className
      )}
      {...props}
    >
      <AsciiGrid
        draw={draw}
        cell={cell}
        ink={ink}
        paper={paper}
        colored={colorMode !== "mono"}
        animate={animate}
        fps={60}
        handle={handle}
        className="absolute inset-0"
      />
      {fx ? <CrtOverlay fx={fx} /> : null}
    </div>
  );
};
