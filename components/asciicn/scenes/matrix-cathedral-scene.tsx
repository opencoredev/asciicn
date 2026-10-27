"use client";

import { useRef } from "react";

import {
  ANSI16,
  AsciiGrid,
  gradeRgb,
  gradeTone,
  hexToRgb,
  nearestIndex,
  PHOSPHORS,
  QUADRANT_GLYPHS,
  RAMPS,
  resolveCharset,
  sampleRamp,
  useAsciiColors,
} from "@/lib/ascii";
import type {
  AsciiGridDrawContext,
  AsciiSceneProps,
  Charset,
  Grade,
  PostFx,
  Rgb8,
} from "@/lib/ascii";

export interface MatrixCathedralSceneProps extends AsciiSceneProps {
  /** How fast the camera glides down the nave, in bays per second. Default 0.35. */
  glide?: number;
  /** Share of glyph columns carrying a falling stream, 0 to 1. Default 0.7. */
  density?: number;
  /** How quickly far streams fade into the fog, 0 to 2. Default 1. */
  fog?: number;
  /** The light at the end of the nave. Default `true`. */
  light?: boolean;
}

const VAULT = {
  backdrop: "#010804",
  deep: hexToRgb("#0a4d2a"),
  fog: hexToRgb("#03140b"),
  glow: hexToRgb("#ffe6a6"),
  head: hexToRgb("#eafff1"),
  stream: hexToRgb("#2bff88"),
} as const;

const DEFAULT_FX: PostFx = { bloom: 0.45, vignette: 0.5 };

// Half-width katakana with hex digits mixed in.
const KATAKANA_STREAM = [
  // U+FF66 to U+FF9D.
  ...Array.from({ length: 56 }, (_, index) =>
    String.fromCodePoint(65_382 + index)
  ),
  ..."0123456789ABCDEF0123456789",
];

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
    const ramp = look.ramp ?? "mainframe";
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
        mix(paper, ink, 0.15 + 0.85 * brightness(rgb) * level),
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
    const ramp = look.ramp ?? "mainframe";
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

// --- Hashing ----------------------------------------------------------------------

/** A stable pseudo-random number in [0, 1) for up to three numbers. */
const random = (a: number, b: number, c: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43_758.545;
  return x - Math.floor(x);
};

/** A stable pseudo-random integer in [0, 2^32). */
const hash = (a: number, b: number, c: number): number =>
  Math.floor(random(a, b, c) * 4_294_967_296);

// --- The vault ----------------------------------------------------------------------

// World units: the nave runs along +z, y is up. NAVE is the pillar line
// (|x|), BAY the pillar spacing along z, SPRING the height where the vault
// springs from the capitals and AISLE the outer wall (|x|).
const NAVE = 1.5;
const PILLAR = 0.24;
const BAY = 1.7;
const FLOOR = -1.15;
const SPRING = 0.85;
const AISLE = 3;
const AISLE_ROOF = 1.6;
const FAR = 34;

type Surface = "pillar" | "spandrel" | "wall" | "floor" | "vault" | "roof";

interface Hit {
  t: number;
  surface: Surface;
  /** Stream coordinates: across the streams, and along the fall. */
  u: number;
  v: number;
  /** Which object, so neighbours don't share streams. */
  id: number;
  /** Surface normal. */
  nx: number;
  ny: number;
  nz: number;
  /** 0 to 1: how close the hit is to a carved rib or arch edge. */
  rib: number;
}

const SURFACE_IDS: Record<Surface, number> = {
  floor: 4,
  pillar: 1,
  roof: 6,
  spandrel: 2,
  vault: 5,
  wall: 3,
};

const archTop = (z: number) => {
  const local = z - Math.round(z / BAY) * BAY;
  // Pillars sit on multiples of BAY; arches span between them.
  const half = BAY / 2;
  const offset = Math.abs(local) - half;
  const springY = SPRING - half * 0.9;
  return springY + Math.sqrt(Math.max(0, half * half - offset * offset)) * 0.9;
};

interface Ray {
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
}

/** Keep a candidate hit if it is the nearest so far. Hot path: positional. */
const offer = (
  hit: Hit,
  t: number,
  surface: Surface,
  u: number,
  v: number,
  id: number,
  nx: number,
  ny: number,
  nz: number,
  rib: number
) => {
  if (t > 1e-4 && t < hit.t) {
    hit.t = t;
    hit.surface = surface;
    hit.u = u;
    hit.v = v;
    hit.id = id;
    hit.nx = nx;
    hit.ny = ny;
    hit.nz = nz;
    hit.rib = rib;
  }
};

/** 1 on a rib across the nave at every bay, fading to 0 at `width`. */
const ribAt = (z: number, width: number) => {
  const offset = Math.abs(z - Math.round(z / BAY) * BAY);
  return offset < width ? 1 - offset / width : 0;
};

const castFloor = ({ ox, oy, oz, dx, dy, dz }: Ray, hit: Hit) => {
  if (dy >= 0) {
    return;
  }
  const t = (FLOOR - oy) / dy;
  const x = ox + dx * t;
  const z = oz + dz * t;
  // Flagstones: joints across each bay and along the pillar lines.
  const along = Math.abs(Math.abs(x) - NAVE) < 0.04 ? 0.6 : 0;
  offer(hit, t, "floor", x, -z, 0, 0, 1, 0, Math.max(ribAt(z, 0.05), along));
};

/** The barrel vault over the nave, x² + (y - SPRING)² = NAVE², seen from inside. */
const castVault = ({ ox, oy, oz, dx, dy, dz }: Ray, hit: Hit) => {
  const py = oy - SPRING;
  const a = dx * dx + dy * dy;
  const b = 2 * (ox * dx + py * dy);
  const c = ox * ox + py * py - NAVE * NAVE;
  const disc = b * b - 4 * a * c;
  if (a < 1e-9 || disc < 0) {
    return;
  }
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  const y = oy + dy * t;
  if (y < SPRING) {
    return;
  }
  const x = ox + dx * t;
  const z = oz + dz * t;
  const angle = Math.atan2(x, y - SPRING);
  offer(
    hit,
    t,
    "vault",
    z,
    -Math.abs(angle) * NAVE,
    angle < 0 ? 1 : 0,
    -x / NAVE,
    -(y - SPRING) / NAVE,
    0,
    ribAt(z, 0.09)
  );
};

/** The three pillars nearest where the ray crosses the pillar line. */
const castPillars = (ray: Ray, side: number, zLine: number, hit: Hit) => {
  const { ox, oy, oz, dx, dy, dz } = ray;
  const px = side * NAVE;
  const a = dx * dx + dz * dz;
  const nearest = Math.round(zLine / BAY);
  for (let k = nearest - 1; k <= nearest + 1; k += 1) {
    const pz = k * BAY;
    const fx = ox - px;
    const fz = oz - pz;
    const b = 2 * (fx * dx + fz * dz);
    const disc = b * b - 4 * a * (fx * fx + fz * fz - PILLAR * PILLAR);
    if (disc < 0) {
      continue;
    }
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    const y = oy + dy * t;
    if (y <= FLOOR || y >= SPRING + 0.05) {
      continue;
    }
    const hx = (ox + dx * t - px) / PILLAR;
    const hz = (oz + dz * t - pz) / PILLAR;
    // Capital and base mouldings read as bright bands.
    const band = y > SPRING - 0.12 || y < FLOOR + 0.1 ? 0.8 : 0;
    offer(
      hit,
      t,
      "pillar",
      Math.atan2(hz, hx) * PILLAR + k * 3.7,
      y,
      k * 2 + (side > 0 ? 1 : 0),
      hx,
      0,
      hz,
      band
    );
  }
};

/** Pillars, the wall over the arches, and the aisle wall seen through them. */
const castSides = (ray: Ray, hit: Hit) => {
  const { ox, oy, oz, dx, dy, dz } = ray;
  if (Math.abs(dx) < 1e-6) {
    return;
  }
  const side = dx >= 0 ? 1 : -1;
  const tLine = (side * NAVE - ox) / dx;
  if (tLine > 0) {
    const zLine = oz + dz * tLine;
    castPillars(ray, side, zLine, hit);
    const y = oy + dy * tLine;
    const top = archTop(zLine);
    if (y < SPRING && y > top) {
      const edge = y - top < 0.07 ? 1 : 0;
      offer(hit, tLine, "spandrel", zLine, y, side, -side, 0, 0, edge);
    }
  }
  const tWall = (side * AISLE - ox) / dx;
  const yWall = oy + dy * tWall;
  if (tWall > 0 && yWall < AISLE_ROOF) {
    offer(hit, tWall, "wall", oz + dz * tWall, yWall, side, -side, 0, 0, 0);
  }
};

const castRoof = ({ ox, oy, oz, dx, dy, dz }: Ray, hit: Hit) => {
  if (dy <= 0) {
    return;
  }
  const t = (AISLE_ROOF - oy) / dy;
  const x = ox + dx * t;
  if (Math.abs(x) > NAVE) {
    offer(
      hit,
      t,
      "roof",
      oz + dz * t,
      -Math.abs(x),
      x > 0 ? 1 : 0,
      0,
      -1,
      0,
      0
    );
  }
};

/** Cast one ray. `hit` is filled; returns false when it escapes into the fog. */
const cast = (ray: Ray, hit: Hit): boolean => {
  hit.t = FAR;
  castFloor(ray, hit);
  castVault(ray, hit);
  castSides(ray, hit);
  castRoof(ray, hit);
  return hit.t < FAR;
};

// --- Glyph choice -------------------------------------------------------------------

type Alphabet = (level: number, seed: number) => string;

// Braille masks grouped by how many of the eight dots they light.
const BRAILLE_BY_DOTS = (() => {
  const groups: number[][] = Array.from({ length: 9 }, () => []);
  for (let mask = 1; mask < 256; mask += 1) {
    let dots = 0;
    for (let rest = mask; rest > 0; rest = Math.floor(rest / 2)) {
      dots += rest % 2;
    }
    groups[dots]?.push(mask);
  }
  return groups;
})();

const alphabetFor = (charset: Charset): Alphabet => {
  if (charset.kind === "braille") {
    // More dots for brighter glyphs: a random pattern with that many dots.
    const { glyphs } = charset;
    return (level, seed) => {
      const dots = Math.max(1, Math.min(8, Math.round(1.5 + level * 6.5)));
      const masks = BRAILLE_BY_DOTS[dots] ?? [];
      return glyphs[masks[seed % masks.length] ?? 255] ?? "⣿";
    };
  }
  if (charset.kind === "quadrants") {
    return (level, seed) => {
      const count = QUADRANT_GLYPHS.length - 1;
      const pick = Math.round(
        level * count * 0.6 + random(seed, 1, 9) * count * 0.4
      );
      return QUADRANT_GLYPHS[Math.max(1, Math.min(count, pick))] ?? "▖";
    };
  }
  if (charset.id === "katakana") {
    return (_level, seed) =>
      KATAKANA_STREAM[seed % KATAKANA_STREAM.length] ?? "ｱ";
  }
  // Ramps: brighter glyphs come from the dense end, jittered so a stream
  // still flickers between neighbours.
  const glyphs = charset.glyphs.slice(1);
  return (level, seed) => {
    const last = glyphs.length - 1;
    const jitter = (random(seed, 3, 5) - 0.5) * Math.max(2, last * 0.25);
    const pick = Math.round(level * last + jitter);
    return glyphs[Math.max(0, Math.min(last, pick))] ?? "#";
  };
};

// --- Streams ------------------------------------------------------------------------

interface Rain {
  readonly density: number;
  readonly time: number;
}

/**
 * Brightness of a stream glyph at (u, v) on a surface, with the glyph's
 * seed. `size` is the glyph pitch in world units for this depth, snapped
 * to powers of two so streams stay stable as they recede.
 */
const streamAt = (
  rain: Rain,
  hit: Hit,
  size: number,
  out: { level: number; head: boolean; seed: number }
) => {
  const surfaceSeed = SURFACE_IDS[hit.surface] * 977 + hit.id * 131;
  const column = Math.floor(hit.u / (size * 0.6));
  const row = Math.floor(hit.v / size);
  const lod = Math.round(Math.log2(size / 0.05));
  const lane = hash(column, surfaceSeed, lod);
  if (lane / 4_294_967_296 > rain.density) {
    out.level = 0;
    out.head = false;
    out.seed = hash(
      column + Math.floor(rain.time * 0.7 + random(column, row, 3) * 9) * 7919,
      row,
      surfaceSeed
    );
    return;
  }
  // Rows per second.
  const speed = 4 + ((lane % 997) / 997) * 9;
  const period = 30 + (lane % 70);
  const tail = 4 + (lane % 9);
  const phase = ((lane % 1009) / 1009) * period;
  const head = phase - rain.time * speed;
  const behind = (((row - head) % period) + period) % period;
  const mutate = Math.floor(
    rain.time * (2 + (lane % 7)) + random(column, row, 5) * 4
  );
  out.seed = hash(column + mutate * 7919, row, surfaceSeed);
  if (behind < 1) {
    out.level = 1;
    out.head = true;
  } else if (behind < tail * 2.2) {
    out.level = Math.exp(-(behind - 1) / tail) * 0.85;
    out.head = false;
  } else {
    out.level = 0;
    out.head = false;
  }
};

// How bright each surface's stone is, so pillars stand out from the dark
// aisles behind them.
const AMBIENT: Record<Surface, number> = {
  floor: 0.12,
  pillar: 0.5,
  roof: 0.05,
  spandrel: 0.32,
  vault: 0.16,
  wall: 0.05,
};

/**
 * Digital Rain Vault. A vaulted nave cast ray by ray on the CPU: rows of
 * pillars and arches, a barrel vault and a floor, every surface covered
 * in falling streams of half-width katakana and hex digits with bright
 * heads and fading tails. Depth fog swallows far streams and a light
 * burns at the end of the nave. The pointer turns the camera.
 */
export const MatrixCathedralScene = ({
  charset = "katakana",
  chars,
  colorMode = "truecolor",
  phosphor,
  ramp,
  ansi,
  grade,
  background = "paper",
  fx = DEFAULT_FX,
  cell = 14,
  speed = 1,
  animate = true,
  fps = 30,
  stillTime = 4,
  interactive = true,
  handle,
  glide = 0.35,
  density = 0.7,
  fog = 1,
  light = true,
  className,
  // Tone-field options have no effect: every glyph is written directly.
  invert: _invert,
  threshold: _threshold,
  edgeThreshold: _edgeThreshold,
  dither: _dither,
  ...props
}: MatrixCathedralSceneProps) => {
  const lookRef = useRef({ pitch: 0, yaw: 0 });
  // Hit distance of the row above, for outlines where depth jumps.
  const aboveRef = useRef(new Float32Array(0));
  const hitRef = useRef<Hit>({
    id: 0,
    nx: 0,
    ny: 1,
    nz: 0,
    rib: 0,
    surface: "floor",
    t: 0,
    u: 0,
    v: 0,
  });
  const streamRef = useRef({ head: false, level: 0, seed: 0 });
  const tokens = useAsciiColors();

  const surface = surfaceColors(
    { background, colorMode, phosphor, ramp },
    VAULT.backdrop
  );
  const ink = sceneInk({ ansi, colorMode, grade, phosphor, ramp }, tokens, {
    ink: VAULT.stream,
    paper: hexToRgb(VAULT.backdrop),
  });
  const alphabet = alphabetFor(resolveCharset(charset, chars));
  // Colours for a quantised stream state, warmth and level, filled on
  // first use, so the per-cell loop never allocates.
  const palette = new Map<number, Rgb8>();
  const colorFor = (shade: number, warmth: number, step: number): Rgb8 => {
    const key = (shade * 8 + warmth) * 16 + step;
    const cached = palette.get(key);
    if (cached) {
      return cached;
    }
    const base =
      shade === 7 ? VAULT.head : mix(VAULT.deep, VAULT.stream, shade / 6);
    const warm = mix(base, VAULT.glow, warmth / 7);
    const level = step / 15;
    const color = ink.tint(
      mix(VAULT.fog, warm, Math.min(1, 0.2 + level)),
      Math.min(1, 0.3 + level)
    );
    palette.set(key, color);
    return color;
  };
  const toneGrade: Grade | undefined = grade;
  const fogDensity = Math.min(2, Math.max(0, fog)) * 0.095;

  const draw = ({
    frame,
    columns,
    rows,
    time,
    delta,
    pointer,
    metrics,
  }: AsciiGridDrawContext) => {
    // The pointer steers the gaze; it eases back to centre when it leaves.
    const look = lookRef.current;
    const active = interactive && pointer.inside;
    const targetYaw = active
      ? (pointer.x / columns - 0.5) * 0.9
      : Math.sin(time * 0.13) * 0.12;
    const targetPitch = active
      ? (0.5 - pointer.y / rows) * 0.55
      : 0.08 + Math.sin(time * 0.09) * 0.05;
    const ease = delta > 0 ? 1 - Math.exp(-delta * 2.5) : 1;
    look.yaw += (targetYaw - look.yaw) * ease;
    look.pitch += (targetPitch - look.pitch) * ease;

    const ox = look.yaw * 0.35;
    const oy = -0.05 + Math.sin(time * 0.8) * 0.02;
    const oz = time * Math.max(0, glide) * BAY;
    const cy = Math.cos(look.yaw);
    const sy = Math.sin(look.yaw);
    const cp = Math.cos(look.pitch);
    const sp = Math.sin(look.pitch);
    const focal = (rows * metrics.height) / 2 / Math.tan((62 * Math.PI) / 360);
    // Roughly the angle one cell covers.
    const pixel = metrics.height / focal;
    const rain: Rain = { density: Math.min(1, Math.max(0, density)), time };
    const hit = hitRef.current;
    const stream = streamRef.current;
    const ray: Ray = { dx: 0, dy: 0, dz: 1, ox, oy, oz };
    if (aboveRef.current.length !== columns) {
      aboveRef.current = new Float32Array(columns);
    }
    const above = aboveRef.current;
    above.fill(FAR);

    for (let row = 0; row < rows; row += 1) {
      let left = FAR;
      const sy0 = (rows / 2 - row - 0.5) * metrics.height;
      for (let column = 0; column < columns; column += 1) {
        const sx0 = (column + 0.5 - columns / 2) * metrics.width;
        // View ray, pitched then turned.
        let dx = sx0;
        let dy = sy0 * cp + focal * sp;
        let dz = -sy0 * sp + focal * cp;
        const rx = dx * cy + dz * sy;
        dz = -dx * sy + dz * cy;
        dx = rx;
        const length = Math.hypot(dx, dy, dz);
        dx /= length;
        dy /= length;
        dz /= length;

        // The light at the end of the nave.
        const toward = Math.max(0, dz);
        // The light at the end of the nave, only worked out near its axis.
        const flare =
          light && toward > 0.9 ? toward ** 900 * 1.5 + toward ** 60 * 0.3 : 0;

        ray.dx = dx;
        ray.dy = dy;
        ray.dz = dz;
        const found = cast(ray, hit);
        const distance = found ? hit.t : FAR;
        // A dark seam on the far side of every depth jump outlines the
        // pillars and arches against what stands behind them.
        const seam =
          distance > Math.min(left, read(above, column)) * 1.22 + 0.15;
        left = distance;
        above[column] = distance;
        if (!found) {
          if (flare > 0.12) {
            const level = Math.min(1, flare);
            frame.put(
              column,
              row,
              alphabet(level, hash(column, row, Math.floor(time * 6))),
              ink.tint(
                mix(VAULT.stream, VAULT.glow, Math.min(1, flare * 1.5)),
                level
              )
            );
          }
          continue;
        }

        if (seam) {
          continue;
        }
        // Glyph pitch in world units: about one cell at this depth, in
        // power-of-two steps so streams hold still as they recede.
        const size =
          0.05 * 2 ** Math.round(Math.log2((distance * pixel) / 0.05));
        streamAt(rain, hit, size, stream);
        const haze = Math.exp(-distance * fogDensity);
        // The stone: lit from the far end of the nave, ribs and mouldings
        // brighter, all fading into the fog.
        const px = ox + dx * distance;
        const py = oy + dy * distance;
        const lx = -px;
        const ly = 0.8 - py;
        const lz = 24;
        const ll = Math.hypot(lx, ly, lz);
        const facing = Math.max(
          0,
          (hit.nx * lx + hit.ny * ly + hit.nz * lz) / ll
        );
        const stone =
          (AMBIENT[hit.surface] * (0.6 + 0.4 * facing) + hit.rib * 0.5) * haze;
        // The light shines through whatever stands in front of it.
        let level = Math.max(stone, stream.level * haze, flare);
        level = gradeTone(level, toneGrade);
        if (level < 0.07) {
          continue;
        }
        const lit = light ? (toward ** 6 * 0.7 + facing * 0.25) * haze : 0;
        let shade = 0;
        if (stream.head) {
          shade = 7;
        } else if (stream.level * haze > stone) {
          shade = Math.round(Math.min(1, stream.level * 1.3) * 6);
        }
        const rgb = colorFor(
          shade,
          Math.round(Math.min(1, lit + flare) * 7),
          Math.round(Math.min(1, level) * 15)
        );
        const at = row * columns + column;
        frame.glyphs[at] = alphabet(
          Math.min(1, level + lit * 0.2),
          stream.seed
        );
        if (frame.colors) {
          frame.colors[at * 4] = read(rgb, 0);
          frame.colors[at * 4 + 1] = read(rgb, 1);
          frame.colors[at * 4 + 2] = read(rgb, 2);
          frame.colors[at * 4 + 3] = 255;
        }
      }
    }
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
