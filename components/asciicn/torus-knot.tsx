"use client";

import { useEffect, useRef } from "react";
import type { ComponentProps, KeyboardEvent, RefObject } from "react";

import {
  ANSI16,
  AsciiGrid,
  CrtOverlay,
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
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiHandle,
  AsciiLook,
  Charset,
  MapOptions,
  MutableFrame,
  Rgb8,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * How the colour stops are laid on the tube in truecolor.
 * - `film`: by surface angle, like oil on water; the colour slides as it turns.
 * - `tube`: along the tube, so you can follow one strand round the knot.
 */
export const KNOT_HUES = ["film", "tube"] as const;
export type KnotHue = (typeof KNOT_HUES)[number];

export interface TorusKnotProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Times the tube winds around the central axis. Default 2. */
  p?: number;
  /** Times the tube passes through the hole. Default 5. */
  q?: number;
  /** Tube radius as a share of the knot's radius, 0.04 to 0.3. Default 0.13. */
  thickness?: number;
  /** How much of the box's shorter side the knot spans, 0.3 to 1. Default 0.86. */
  size?: number;
  /** Turn around the knot's own axis, in radians per second. Default 0.25. */
  spin?: number;
  /** Time multiplier for the spin and the slow sway. Default 1. */
  speed?: number;
  /** Truecolor stops, looping back to the first. Default `["orange", "pink", "purple", "blue"]`. */
  colors?: readonly AsciiColor[];
  /** Default `"film"`. */
  hue?: KnotHue;
  /** Where the key light comes from, in degrees clockwise from the top. Default 320. */
  light?: number;
  /**
   * Ramp charsets (`standard`, `dense`, `edge` or `chars`) draw `- / | \`
   * along the silhouette, following the outline. Default `true`.
   */
  contours?: boolean;
  /** Drag or use the arrow keys to turn it; it coasts after a drag. Default `true`. */
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
    return (RAMPS[ramp as keyof typeof RAMPS] ?? RAMPS.vapor)[0];
  }
  return ramp?.[0] ?? RAMPS.vapor[0];
};

const lumaOf = (rgb: Rgb8) =>
  (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;

/**
 * Glyph options, ink and paper for a look. Truecolor and ansi16 cells are
 * recoloured afterwards from the lit samples only (see `colorCells`).
 */
const knotLook = (
  look: AsciiLook,
  charset: Charset,
  theme: readonly (readonly number[])[] | null
) => {
  const themeInk = theme?.[0] ? toBytes(theme[0]) : ([230, 230, 230] as Rgb8);
  const themePaper = theme?.[1] ? toBytes(theme[1]) : ([10, 10, 10] as Rgb8);
  const mode = look.colorMode ?? "truecolor";
  let ink: AsciiColor = "--ascii-ink";
  let paper: AsciiColor = "--ascii-paper";
  let palette: readonly Rgb8[] = [themePaper, themeInk];
  if (mode === "duotone") {
    paper = rampPaper(look.ramp);
    palette = [hexToRgb(paper), themeInk];
  } else if (look.phosphor && mode === "mono") {
    const preset = PHOSPHORS[look.phosphor];
    ({ ink, paper } = preset);
    palette = [hexToRgb(preset.paper), hexToRgb(preset.ink)];
  }
  // Braille and quadrants light a dot or leave it dark: an ordered matrix
  // keeps the shading as an even dot pattern instead of one hard terminator.
  const packed = charset.kind === "braille" || charset.kind === "quadrants";
  const sampled = mode === "truecolor" || mode === "ansi16";
  const options: MapOptions = {
    charset,
    // Any colour mode but mono keeps the frame's colour buffer.
    colorMode: sampled ? "palette" : mode,
    dither: look.dither ?? (packed ? "bayer4" : "none"),
    edgeThreshold: look.edgeThreshold,
    grade: look.grade,
    invert: look.invert,
    palette,
    ramp: look.ramp ?? "vapor",
    threshold: look.threshold,
  };
  return {
    ink,
    // Phosphor and duotone glass is dark; only the theme paper can be light.
    lumaLimit: paper === "--ascii-paper" && lumaOf(themePaper) > 0.5 ? 0.5 : 1,
    mode,
    options,
    packed,
    paper: look.background === "transparent" ? ("transparent" as const) : paper,
  };
};

/* -------------------------------------------------------------------------- */
/* Drag to spin                                                                */
/* -------------------------------------------------------------------------- */

interface Spin {
  /** Tilt added by dragging, around the horizontal (x) and vertical (y) axes. */
  x: number;
  y: number;
  /** Angle around the knot's own axis. */
  roll: number;
  /** Extra angular velocity from a drag, decaying back to 0. */
  vx: number;
  vy: number;
  dragging: boolean;
}

/** Pointer drags turn the knot; the last drag velocity coasts and fades. */
const useDragSpin = (
  ref: RefObject<HTMLDivElement | null>,
  spin: RefObject<Spin>,
  enabled: boolean
) => {
  useEffect(() => {
    const root = ref.current;
    if (!(root && enabled)) {
      return;
    }
    let last = { t: 0, x: 0, y: 0 };
    const down = (event: PointerEvent) => {
      spin.current.dragging = true;
      spin.current.vx = 0;
      spin.current.vy = 0;
      last = { t: event.timeStamp, x: event.clientX, y: event.clientY };
      root.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!spin.current.dragging) {
        return;
      }
      const size = Math.max(120, Math.min(root.clientWidth, root.clientHeight));
      const dx = ((event.clientX - last.x) / size) * Math.PI;
      const dy = ((event.clientY - last.y) / size) * Math.PI;
      const dt = Math.max(1, event.timeStamp - last.t) / 1000;
      spin.current.y += dx;
      spin.current.x += dy;
      spin.current.vy = dx / dt;
      spin.current.vx = dy / dt;
      last = { t: event.timeStamp, x: event.clientX, y: event.clientY };
    };
    const up = () => {
      spin.current.dragging = false;
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
  }, [ref, spin, enabled]);
};

/* -------------------------------------------------------------------------- */
/* Mesh                                                                        */
/* -------------------------------------------------------------------------- */

const SIDES = 18;
// Camera distance from the knot's centre, in knot radii.
const CAMERA = 4.2;

interface Mesh {
  readonly key: string;
  readonly segments: number;
  /** Object-space vertex positions and normals, 3 per vertex. */
  readonly position: Float32Array;
  readonly normal: Float32Array;
  /** How far round the knot each ring sits, 0 to 1. */
  readonly along: Float32Array;
  /** Per frame: screen x, screen y and depth, then the view-space normal. */
  readonly screen: Float32Array;
  readonly view: Float32Array;
}

/** A point on the (p, q) torus knot, at most 1 from the centre. */
const knotPoint = (p: number, q: number, t: number, out: Float64Array) => {
  const r = 2 + Math.cos(q * t);
  out[0] = (r * Math.cos(p * t)) / 3;
  out[1] = (r * Math.sin(p * t)) / 3;
  out[2] = -Math.sin(q * t) / 3;
};

/** Sweep a tube along the knot. Built once per shape, not per frame. */
const buildMesh = (p: number, q: number, tube: number, key: string): Mesh => {
  // Longer knots need more rings to stay round in the bends.
  const segments = Math.min(900, Math.max(240, 70 * Math.max(p, q)));
  const count = segments * SIDES;
  const mesh: Mesh = {
    along: new Float32Array(segments),
    key,
    normal: new Float32Array(count * 3),
    position: new Float32Array(count * 3),
    screen: new Float32Array(count * 3),
    segments,
    view: new Float32Array(count * 3),
  };
  const here = new Float64Array(3);
  const back = new Float64Array(3);
  const ahead = new Float64Array(3);
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    const step = (Math.PI * 2) / segments;
    knotPoint(p, q, t, here);
    knotPoint(p, q, t - step, back);
    knotPoint(p, q, t + step, ahead);
    mesh.along[i] = i / segments;
    let tx = (ahead[0] ?? 0) - (back[0] ?? 0);
    let ty = (ahead[1] ?? 0) - (back[1] ?? 0);
    let tz = (ahead[2] ?? 0) - (back[2] ?? 0);
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // The frame follows the radial direction, which closes on itself round
    // the loop, so the tube never twists at the seam.
    const px = here[0] ?? 0;
    const py = here[1] ?? 0;
    const pz = here[2] ?? 0;
    const rl = Math.hypot(px, py) || 1;
    let nx = px / rl;
    let ny = py / rl;
    let nz = 0;
    const dot = nx * tx + ny * ty;
    nx -= tx * dot;
    ny -= ty * dot;
    nz -= tz * dot;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;
    for (let j = 0; j < SIDES; j += 1) {
      const angle = (j / SIDES) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const ox = nx * c + bx * s;
      const oy = ny * c + by * s;
      const oz = nz * c + bz * s;
      const at = (i * SIDES + j) * 3;
      mesh.normal[at] = ox;
      mesh.normal[at + 1] = oy;
      mesh.normal[at + 2] = oz;
      mesh.position[at] = px + ox * tube;
      mesh.position[at + 1] = py + oy * tube;
      mesh.position[at + 2] = pz + oz * tube;
    }
  }
  return mesh;
};

/** Object-to-view rotation, row-major: around z by `c`, y by `b`, then x by `a`. */
const rotation = (a: number, b: number, c: number, into: Float64Array) => {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const cc = Math.cos(c);
  const sc = Math.sin(c);
  // Rx(a) * Ry(b) * Rz(c)
  into[0] = cb * cc;
  into[1] = -cb * sc;
  into[2] = sb;
  into[3] = sa * sb * cc + ca * sc;
  into[4] = -sa * sb * sc + ca * cc;
  into[5] = -sa * cb;
  into[6] = -ca * sb * cc + sa * sc;
  into[7] = ca * sb * sc + sa * cc;
  into[8] = ca * cb;
};

interface Projection {
  readonly m: Float64Array;
  readonly cx: number;
  readonly cy: number;
  /** One knot radius at the centre plane, in sample rows. */
  readonly unit: number;
  /** Sample width over sample height. */
  readonly aspect: number;
}

/** Rotate and project every vertex. View z points at the viewer. */
// oxlint-disable-next-line complexity -- one tight loop; each typed-array read counts as a branch.
const transform = (mesh: Mesh, view: Projection) => {
  const { m, cx, cy, unit, aspect } = view;
  const { position, normal, screen } = mesh;
  const out = mesh.view;
  for (let at = 0; at < position.length; at += 3) {
    const x = position[at] ?? 0;
    const y = position[at + 1] ?? 0;
    const z = position[at + 2] ?? 0;
    const vx = (m[0] ?? 0) * x + (m[1] ?? 0) * y + (m[2] ?? 0) * z;
    const vy = (m[3] ?? 0) * x + (m[4] ?? 0) * y + (m[5] ?? 0) * z;
    const vz = (m[6] ?? 0) * x + (m[7] ?? 0) * y + (m[8] ?? 0) * z;
    const depth = CAMERA - vz;
    const f = CAMERA / depth;
    screen[at] = cx + (vx * f * unit) / aspect;
    screen[at + 1] = cy - vy * f * unit;
    screen[at + 2] = depth;
    const nx = normal[at] ?? 0;
    const ny = normal[at + 1] ?? 0;
    const nz = normal[at + 2] ?? 0;
    out[at] = (m[0] ?? 0) * nx + (m[1] ?? 0) * ny + (m[2] ?? 0) * nz;
    out[at + 1] = (m[3] ?? 0) * nx + (m[4] ?? 0) * ny + (m[5] ?? 0) * nz;
    out[at + 2] = (m[6] ?? 0) * nx + (m[7] ?? 0) * ny + (m[8] ?? 0) * nz;
  }
};

/* -------------------------------------------------------------------------- */
/* Raster                                                                      */
/* -------------------------------------------------------------------------- */

interface Buffers {
  readonly key: string;
  readonly field: ToneField;
  readonly depth: Float32Array;
  /** Interpolated view-space normal per sample. */
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  /** How far round the knot each sample sits, 0 to 1. */
  readonly along: Float32Array;
  /** Lit colour per sample, RGB bytes. */
  readonly rgb: Uint8ClampedArray;
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
    along: new Float32Array(size),
    depth: new Float32Array(size),
    field,
    key,
    nx: new Float32Array(size),
    ny: new Float32Array(size),
    nz: new Float32Array(size),
    rgb: new Uint8ClampedArray(size * 3),
  };
};

/** Fill one triangle into the depth, normal and position buffers. */
// oxlint-disable-next-line complexity -- one tight loop over the triangle's samples.
const rasterTriangle = (
  buffers: Buffers,
  mesh: Mesh,
  ia: number,
  ib: number,
  ic: number,
  along: number
) => {
  const { screen, view } = mesh;
  const a = ia * 3;
  const b = ib * 3;
  const c = ic * 3;
  const ax = screen[a] ?? 0;
  const ay = screen[a + 1] ?? 0;
  const bx = screen[b] ?? 0;
  const by = screen[b + 1] ?? 0;
  const cx = screen[c] ?? 0;
  const cy = screen[c + 1] ?? 0;
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  // Faces turned away are hidden by the near side of the tube anyway.
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
  const az = screen[a + 2] ?? 0;
  const bz = screen[b + 2] ?? 0;
  const cz = screen[c + 2] ?? 0;
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
      if (z >= (depth[index] ?? 0)) {
        continue;
      }
      depth[index] = z;
      nx[index] =
        w0 * (view[a] ?? 0) + w1 * (view[b] ?? 0) + w2 * (view[c] ?? 0);
      ny[index] =
        w0 * (view[a + 1] ?? 0) +
        w1 * (view[b + 1] ?? 0) +
        w2 * (view[c + 1] ?? 0);
      nz[index] =
        w0 * (view[a + 2] ?? 0) +
        w1 * (view[b + 2] ?? 0) +
        w2 * (view[c + 2] ?? 0);
      buffers.along[index] = along;
    }
  }
};

/** Every quad of the tube as two triangles. */
const rasterMesh = (buffers: Buffers, mesh: Mesh) => {
  const { segments } = mesh;
  for (let i = 0; i < segments; i += 1) {
    const i1 = (i + 1) % segments;
    const along = mesh.along[i] ?? 0;
    for (let j = 0; j < SIDES; j += 1) {
      const j1 = (j + 1) % SIDES;
      const a = i * SIDES + j;
      const c = i1 * SIDES + j1;
      rasterTriangle(buffers, mesh, a, i1 * SIDES + j, c, along);
      rasterTriangle(buffers, mesh, a, c, i * SIDES + j1, along);
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Shading                                                                     */
/* -------------------------------------------------------------------------- */

interface Lighting {
  readonly key: readonly [number, number, number];
  readonly half: readonly [number, number, number];
  readonly stops: readonly Rgb8[];
  readonly hue: KnotHue;
  readonly drift: number;
  /** Nearest and farthest depth the knot can reach, for depth fade. */
  readonly near: number;
  readonly span: number;
  /**
   * Raises every lit tone toward full, along a square root. Braille and
   * quadrants light a dot only above half tone, so without it the shadow
   * side turns to dust.
   */
  readonly lift: number;
}

const normalize3 = (
  x: number,
  y: number,
  z: number
): readonly [number, number, number] => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

/** A looping colour along the tube: the stops, then back to the first. */
const loopColor = (stops: readonly Rgb8[], t: number): Rgb8 => {
  const [first] = stops;
  if (!first) {
    return [255, 255, 255];
  }
  return sampleRamp([...stops, first], t - Math.floor(t));
};

/**
 * Light every covered sample: a key light, a tight highlight that reaches
 * the densest glyphs, a rim where the tube turns away and a fade with
 * depth, so near strands read in front of far ones.
 */
const shadeKnot = (buffers: Buffers, light: Lighting) => {
  const { field, depth, nx, ny, nz, rgb, along } = buffers;
  const [lx, ly, lz] = light.key;
  const [hx, hy, hz] = light.half;
  for (let index = 0; index < field.tones.length; index += 1) {
    const d = depth[index] ?? Number.POSITIVE_INFINITY;
    if (d === Number.POSITIVE_INFINITY) {
      field.tones[index] = 0;
      continue;
    }
    let x = nx[index] ?? 0;
    let y = ny[index] ?? 0;
    let z = nz[index] ?? 0;
    const length = Math.hypot(x, y, z) || 1;
    x /= length;
    y /= length;
    z /= length;
    nx[index] = x;
    ny[index] = y;
    nz[index] = z;
    const diffuse = Math.max(0, x * lx + y * ly + z * lz);
    const specular = Math.max(0, x * hx + y * hy + z * hz) ** 36;
    const rim = (1 - Math.max(0, z)) ** 3;
    const closeness = Math.min(
      1,
      Math.max(0, 1 - (d - light.near) / light.span)
    );
    const fade = 0.6 + 0.4 * closeness;
    const tone = Math.min(
      1,
      (0.04 + 0.8 * diffuse ** 1.1 + 0.18 * rim) * fade + 0.6 * specular
    );
    field.tones[index] =
      light.lift > 0 ? light.lift + (1 - light.lift) * Math.sqrt(tone) : tone;
    // Colour carries less of the shading than tone does: glyph density
    // already darkens the shadow side, and dim colour on top turns muddy.
    const lit = (0.5 + 0.5 * diffuse) * (0.72 + 0.28 * closeness);
    const shine = specular * 235 + rim * 24;
    // Thin film: the stop shifts with the normal's direction and the rim.
    const t =
      light.hue === "film"
        ? 0.4 * x + 0.28 * y + 0.4 * rim + light.drift
        : (along[index] ?? 0) + light.drift;
    const [r, g, b] = loopColor(light.stops, t);
    const at = index * 3;
    rgb[at] = r * lit + shine;
    rgb[at + 1] = g * lit + shine;
    rgb[at + 2] = b * lit + shine;
  }
};

/**
 * Where a strand passes over another, clear a thin gap on the far one
 * around the near one's edge, like the breaks in a knot diagram. It keeps
 * every crossing readable even when glyphs blur the shading.
 */
const cutCrossings = (
  buffers: Buffers,
  gap: number,
  reachX: number,
  reachY: number
) => {
  const { field, depth } = buffers;
  const { width, height, tones } = field;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const d = depth[index] ?? Number.POSITIVE_INFINITY;
      if (d === Number.POSITIVE_INFINITY) {
        continue;
      }
      let cut = false;
      for (let dy = -reachY; dy <= reachY && !cut; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) {
          continue;
        }
        for (let dx = -reachX; dx <= reachX; dx += 1) {
          const xx = x + dx;
          if (
            xx >= 0 &&
            xx < width &&
            (depth[yy * width + xx] ?? d) < d - gap
          ) {
            cut = true;
            break;
          }
        }
      }
      if (cut) {
        tones[index] = 0;
      }
    }
  }
};

const CONTOUR_SETS = new Set(["standard", "dense", "edge", "custom"]);

/** Directional glyphs where the surface turns edge-on to the viewer. */
const drawContours = (buffers: Buffers, frame: MutableFrame) => {
  const { field, nx, ny, nz } = buffers;
  for (let index = 0; index < field.tones.length; index += 1) {
    if ((field.tones[index] ?? 0) <= 0) {
      continue;
    }
    const z = nz[index] ?? 1;
    if (z < 0.22) {
      // The outline runs across the normal; screen y points down.
      frame.glyphs[index] = edgeChar(nx[index] ?? 0, -(ny[index] ?? 0));
    }
  }
};

/**
 * Colour every inked cell from its lit samples, weighted by tone, so a
 * thin Braille edge keeps its full colour instead of averaging with the
 * empty samples around it.
 */
const colorCells = (
  buffers: Buffers,
  charset: Charset,
  frame: MutableFrame,
  {
    ansi,
    grade,
    lumaLimit,
  }: {
    ansi: readonly Rgb8[] | null;
    grade: AsciiLook["grade"];
    lumaLimit: number;
  }
) => {
  const { field, rgb } = buffers;
  const [gx, gy] = charset.grid;
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
          const tone = field.tones[base + dx] ?? 0;
          if (tone > 0) {
            const at = (base + dx) * 3;
            r += (rgb[at] ?? 0) * tone;
            g += (rgb[at + 1] ?? 0) * tone;
            b += (rgb[at + 2] ?? 0) * tone;
            weight += tone;
          }
        }
      }
      if (weight === 0) {
        continue;
      }
      let color: Rgb8 = gradeRgb([r / weight, g / weight, b / weight], grade);
      const value = lumaOf(color);
      if (value > lumaLimit) {
        // On a light page, near-white glyphs vanish into the paper.
        const scale = lumaLimit / value;
        color = [color[0] * scale, color[1] * scale, color[2] * scale];
      }
      if (ansi) {
        color = ansi[nearestIndex(color, ansi)] ?? color;
      }
      colors.set([color[0], color[1], color[2], 255], cell * 4);
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

const KEYS: Partial<Record<string, readonly [number, number]>> = {
  ArrowDown: [0.18, 0],
  ArrowLeft: [0, -0.18],
  ArrowRight: [0, 0.18],
  ArrowUp: [-0.18, 0],
};

const DEFAULT_COLORS = ["orange", "pink", "purple", "blue"] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A whole winding count of at least 1. */
const winding = (value: number) => Math.max(1, Math.round(value) || 1);

/**
 * A (p, q) torus knot drawn in glyphs on the CPU. A tube is swept along
 * the knot, projected in perspective and rasterised into a depth buffer at
 * the charset's own sample grid, then lit per sample from its normal: a
 * key light, a tight highlight, a rim and a fade with depth. Where one
 * strand crosses another the far one breaks, so the over and under stay
 * readable in any charset.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const TorusKnot = ({
  p = 2,
  q = 5,
  thickness = 0.13,
  size = 0.86,
  spin = 0.25,
  speed = 1,
  colors = DEFAULT_COLORS,
  hue = "film",
  light = 320,
  contours = true,
  interactive = true,
  cell = 10,
  animate = true,
  handle,
  charset = "blocks",
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
}: TorusKnotProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useAsciiColors(rootRef, [
    "--ascii-ink",
    "--ascii-paper",
    ...colors,
  ]);
  const reducedMotion = usePrefersReducedMotion();
  const spinRef = useRef<Spin>({
    dragging: false,
    roll: 0,
    vx: 0,
    vy: 0,
    x: 0,
    y: 0,
  });
  useDragSpin(rootRef, spinRef, interactive);
  const meshRef = useRef<Mesh | null>(null);
  const buffersRef = useRef<Buffers | null>(null);
  const matrix = useRef(new Float64Array(9));

  const resolved = resolveCharset(charset, chars);
  const look = knotLook(
    {
      background,
      colorMode,
      dither,
      edgeThreshold,
      grade,
      invert,
      phosphor,
      ramp,
      threshold,
    },
    resolved,
    theme
  );
  // Until the theme is read, a warm grey keeps the first frame visible.
  const stops: readonly Rgb8[] = theme
    ? theme.slice(2).map((rgba) => toBytes(rgba))
    : [[200, 190, 180]];
  const windings = { p: winding(p), q: winding(q) };
  const tube = clamp(thickness, 0.04, 0.3);

  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    delta,
    time,
  }: AsciiGridDrawContext) => {
    const state = spinRef.current;
    if (delta > 0) {
      state.roll += spin * speed * delta;
      if (!state.dragging) {
        // Coast after a drag, then come to rest where it was left.
        state.x += state.vx * delta;
        state.y += state.vy * delta;
        const fade = Math.exp(-delta * 1.6);
        state.vx *= fade;
        state.vy *= fade;
      }
    } else if (!animate || reducedMotion) {
      state.roll = spin * speed * time;
    }

    const meshKey = `${windings.p}:${windings.q}:${tube}`;
    if (meshRef.current?.key !== meshKey) {
      meshRef.current = buildMesh(windings.p, windings.q, tube, meshKey);
    }
    const mesh = meshRef.current;
    const [gx, gy] = resolved.grid;
    const bufferKey = `${columns}x${rows}x${gx}x${gy}`;
    if (buffersRef.current?.key !== bufferKey) {
      buffersRef.current = createBuffers(columns, rows, resolved, bufferKey);
    }
    const buffers = buffersRef.current;
    const { field } = buffers;
    buffers.depth.fill(Number.POSITIVE_INFINITY);

    // A torus knot reads best near face on, so it turns on its own axis
    // and sways a little to show its depth, rather than tumbling edge on.
    rotation(
      0.6 + 0.16 * Math.sin(time * 0.23) + state.x,
      0.22 * Math.sin(time * 0.17) + state.y,
      state.roll,
      matrix.current
    );
    const aspect = metrics.width / gx / (metrics.height / gy);
    // The knot reaches 1 + tube from its centre. Perspective enlarges the
    // near side, but the tilt keeps it from facing the camera fully.
    const reach = (1 + tube) * 1.12;
    const unit =
      (Math.min(field.width * aspect, field.height) / 2 / reach) *
      clamp(size, 0.3, 1);
    transform(mesh, {
      aspect,
      cx: field.width / 2,
      cy: field.height / 2,
      m: matrix.current,
      unit,
    });
    rasterMesh(buffers, mesh);

    const angle = (light * Math.PI) / 180;
    const key = normalize3(Math.sin(angle) * 0.85, Math.cos(angle) * 0.85, 0.7);
    shadeKnot(buffers, {
      drift: time * 0.04,
      half: normalize3(key[0], key[1], key[2] + 1),
      hue,
      key,
      lift: look.packed ? 0.12 : 0,
      near: CAMERA - 1 - tube,
      span: 2 + 2 * tube,
      stops,
    });
    // The gap is a little wider than a sample so it survives Braille.
    cutCrossings(
      buffers,
      tube * 1.7,
      Math.max(1, Math.round(gx / 2)),
      Math.max(1, Math.round(gy / 2))
    );

    mapTones(field, columns, rows, look.options, frame);
    if (contours && !look.packed && CONTOUR_SETS.has(resolved.id)) {
      drawContours(buffers, frame);
    }
    if (look.mode === "truecolor" || look.mode === "ansi16") {
      colorCells(buffers, resolved, frame, {
        ansi: look.mode === "ansi16" ? ANSI16[ansi ?? "vga"] : null,
        grade,
        lumaLimit: look.lumaLimit,
      });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEYS[event.key];
    if (!(interactive && step)) {
      return;
    }
    event.preventDefault();
    spinRef.current.x += step[0];
    spinRef.current.y += step[1];
  };

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={
        ariaLabel ??
        (interactive
          ? `A (${windings.p}, ${windings.q}) torus knot drawn in glyphs. Drag it or use the arrow keys to turn it.`
          : `A (${windings.p}, ${windings.q}) torus knot drawn in glyphs.`)
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
        ink={look.ink}
        paper={look.paper}
        colored={look.mode !== "mono"}
        animate={animate}
        fps={60}
        stillTime={2}
        handle={handle}
        className="absolute inset-0"
      />
      {fx ? <CrtOverlay fx={fx} /> : null}
    </div>
  );
};
