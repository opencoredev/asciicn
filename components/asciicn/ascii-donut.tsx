"use client";

import { useEffect, useRef } from "react";
import type { ComponentProps, KeyboardEvent, RefObject } from "react";

import {
  AsciiGrid,
  CrtOverlay,
  createToneField,
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
  Rgb8,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * The torus surface.
 * - `smooth`: a plain ring.
 * - `ribbed`: grooves wound around the tube, which catch the light as it turns.
 */
export const DONUT_SURFACES = ["smooth", "ribbed"] as const;
export type DonutSurface = (typeof DONUT_SURFACES)[number];

export interface AsciiDonutProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Ring radius, as a share of half the box's shorter side. Default 0.5. */
  radius?: number;
  /** Tube radius over ring radius, 0.1 to 0.9. Default 0.46. */
  thickness?: number;
  /** Turn around the ring's own axis, in radians per second. Shows on the ribbed surface. Default 0.4. */
  spin?: number;
  /** Time multiplier for the spin and the slow rocking. 0 holds it still. Default 1. */
  speed?: number;
  /** Default `"smooth"`. */
  surface?: DonutSurface;
  /** Body colour in truecolor. Default `"orange"`. */
  color?: AsciiColor;
  /** Rim light colour in truecolor, from behind. Default `"blue"`. */
  rim?: AsciiColor;
  /** Where the key light comes from, in degrees clockwise from the top. Default 315. */
  light?: number;
  /** A soft shadow on an unseen floor. Default `true`. */
  floor?: boolean;
  /** Drag or use the arrow keys to turn it; it coasts after a drag. Default `true`. */
  draggable?: boolean;
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
 * dithering keeps soft shading as a stipple instead of one hard edge.
 */
const packedDither = (look: AsciiLook): "none" | "blue-noise" => {
  const { kind } = resolveCharset(look.charset ?? "standard", look.chars);
  return kind === "braille" || kind === "quadrants" ? "blue-noise" : "none";
};

/**
 * On a light page, near-white glyphs vanish into the paper. Scale a
 * colour down so its luma stays at or under `limit`; dark pages pass 1.
 */
const capLuma = (out: Float64Array, limit: number) => {
  const value =
    (0.2126 * (out[1] ?? 0) + 0.7152 * (out[2] ?? 0) + 0.0722 * (out[3] ?? 0)) /
    255;
  if (value > limit) {
    const scale = limit / value;
    out[1] = (out[1] ?? 0) * scale;
    out[2] = (out[2] ?? 0) * scale;
    out[3] = (out[3] ?? 0) * scale;
  }
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

/* -------------------------------------------------------------------------- */
/* Drag to spin                                                                */
/* -------------------------------------------------------------------------- */

interface Spin {
  /** Seconds of idle motion, scaled by `speed`. */
  clock: number;
  /** Drag offsets from the resting pose, around the horizontal (x) and vertical (y) axes. */
  x: number;
  y: number;
  /** Extra angular velocity from a drag, decaying back to 0. */
  vx: number;
  vy: number;
  dragging: boolean;
}

/** Pointer drags turn the torus; the last drag velocity coasts and fades. Plain hover does nothing. */
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
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

const clamp01 = (value: number) => (value > 0 ? Math.min(value, 1) : 0);

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// Camera distance from the centre, in units of the ring's bounding radius.
const CAMERA = 3.4;
const FOCAL = 2.6;
const MAX_STEPS = 64;
const RIBS = 22;

interface Scene {
  ring: number;
  tube: number;
  ribbed: boolean;
  /** Rows of the object-to-view rotation matrix. */
  m: Float64Array;
  /** Key light, rim light and half vector, in view space. */
  key: readonly [number, number, number];
  back: readonly [number, number, number];
  half: readonly [number, number, number];
  body: Rgb8;
  rimColor: Rgb8;
  floor: boolean;
}

const normalize3 = (
  x: number,
  y: number,
  z: number
): readonly [number, number, number] => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

/** Signed distance to the torus (around the y axis) in object space. */
const torusDistance = (
  scene: Scene,
  x: number,
  y: number,
  z: number
): number => {
  const radial = Math.hypot(x, z);
  let distance = Math.hypot(radial - scene.ring, y) - scene.tube;
  if (scene.ribbed) {
    // Grooves wound around the tube: shallow enough to march safely.
    const around = Math.atan2(z, x);
    distance += 0.018 * Math.sin(around * RIBS) * scene.tube * 3;
  }
  return distance;
};

/**
 * Shade one ray. Returns tone (0 to 1) and colour bytes, or tone 0 for
 * empty space. View space: x right, y up, z into the screen.
 */
const shade = (scene: Scene, u: number, v: number, out: Float64Array): void => {
  const { m } = scene;
  // Ray from the camera through (u, v) on the focal plane.
  const dx = u / FOCAL;
  const dy = v / FOCAL;
  const inverse = 1 / Math.hypot(dx, dy, 1);
  const rx = dx * inverse;
  const ry = dy * inverse;
  const rz = inverse;
  // Into object space with the transposed rotation.
  const ox = m[6] * -CAMERA;
  const oy = m[7] * -CAMERA;
  const oz = m[8] * -CAMERA;
  const dirX = m[0] * rx + m[3] * ry + m[6] * rz;
  const dirY = m[1] * rx + m[4] * ry + m[7] * rz;
  const dirZ = m[2] * rx + m[5] * ry + m[8] * rz;

  // Skip rays that miss the bounding sphere.
  const bound = scene.ring + scene.tube * 1.1;
  const b = ox * dirX + oy * dirY + oz * dirZ;
  const c = ox * ox + oy * oy + oz * oz - bound * bound;
  const disc = b * b - c;
  out[0] = 0;
  if (disc < 0) {
    if (scene.floor) {
      // A soft elliptical shadow on a floor below the ring.
      const fy = (v + 1.18) / 0.09;
      const shadow = Math.exp(-(u * u) / 0.6 - fy * fy);
      out[0] = shadow * 0.16;
      out[1] = scene.body[0] * 0.5;
      out[2] = scene.body[1] * 0.5;
      out[3] = scene.body[2] * 0.5;
    }
    return;
  }
  let t = Math.max(0, -b - Math.sqrt(disc));
  const far = -b + Math.sqrt(disc);
  let hit = false;
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let step = 0; step < MAX_STEPS && t < far; step += 1) {
    px = ox + dirX * t;
    py = oy + dirY * t;
    pz = oz + dirZ * t;
    const distance = torusDistance(scene, px, py, pz);
    if (distance < 0.0015) {
      hit = true;
      break;
    }
    t += distance * (scene.ribbed ? 0.7 : 0.95);
  }
  if (!hit) {
    return;
  }

  // Object-space normal: analytic for the ring, finite differences for ribs.
  let nx: number;
  let ny: number;
  let nz: number;
  const radial = Math.hypot(px, pz) || 1;
  if (scene.ribbed) {
    const e = 0.002;
    nx =
      torusDistance(scene, px + e, py, pz) -
      torusDistance(scene, px - e, py, pz);
    ny =
      torusDistance(scene, px, py + e, pz) -
      torusDistance(scene, px, py - e, pz);
    nz =
      torusDistance(scene, px, py, pz + e) -
      torusDistance(scene, px, py, pz - e);
  } else {
    nx = px - (px / radial) * scene.ring;
    ny = py;
    nz = pz - (pz / radial) * scene.ring;
  }
  const length = Math.hypot(nx, ny, nz) || 1;
  nx /= length;
  ny /= length;
  nz /= length;
  // Into view space.
  const vx = m[0] * nx + m[1] * ny + m[2] * nz;
  const vy = m[3] * nx + m[4] * ny + m[5] * nz;
  const vz = m[6] * nx + m[7] * ny + m[8] * nz;

  const [kx, ky, kz] = scene.key;
  const [bx, by, bz] = scene.back;
  const [hx, hy, hz] = scene.half;
  const diffuse = Math.max(0, vx * kx + vy * ky + vz * kz);
  const backLight = Math.max(0, vx * bx + vy * by + vz * bz);
  const facing = Math.max(0, -(vx * rx + vy * ry + vz * rz));
  const fresnel = (1 - facing) ** 3;
  const specular = Math.max(0, vx * hx + vy * hy + vz * hz) ** 48;
  // The inside of the ring sees less sky.
  const occlusion =
    0.55 + 0.45 * smoothstep(-scene.tube, scene.tube, radial - scene.ring);

  const tone =
    (0.06 + 0.78 * diffuse ** 1.2) * occlusion +
    0.3 * backLight * fresnel +
    0.85 * specular;
  out[0] = clamp01(tone);
  const warm = (0.12 + 0.95 * diffuse) * occlusion;
  const cool = 0.9 * backLight * fresnel + 0.1 * fresnel;
  const shine = specular * 255;
  out[1] = Math.min(
    255,
    scene.body[0] * warm + scene.rimColor[0] * cool + shine
  );
  out[2] = Math.min(
    255,
    scene.body[1] * warm + scene.rimColor[1] * cool + shine
  );
  out[3] = Math.min(
    255,
    scene.body[2] * warm + scene.rimColor[2] * cool + shine
  );
};

/** Object-to-view rotation: around x by `a`, then around y by `b`. */
const rotation = (a: number, b: number, c: number, into: Float64Array) => {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const cc = Math.cos(c);
  const sc = Math.sin(c);
  // R = Ry(b) * Rx(a) * Ry(c), row-major: spin around the ring's own axis,
  // lean it toward the camera, then turn it.
  into.set([
    cb * cc - sb * ca * sc,
    sb * sa,
    cb * sc + sb * ca * cc,
    sa * sc,
    ca,
    -sa * cc,
    -sb * cc - cb * ca * sc,
    cb * sa,
    -sb * sc + cb * ca * cc,
  ]);
};

// The resting lean, in radians from edge-on: the top of the ring tips
// toward the camera, so you look down onto the lit face with the hole
// open, a clear three-quarter view. The slow rocking stays within
// TILT_SWAY and TURN_SWAY of it, so the ring never turns edge-on.
const REST_TILT = -0.62;
const TILT_SWAY = 0.1;
const TURN_SWAY = 0.42;

/** Wrap an angle into -PI to PI, so a drag offset eases back the short way. */
const wrap = (angle: number) =>
  angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));

const KEYS: Partial<Record<string, readonly [number, number]>> = {
  ArrowDown: [0.18, 0],
  ArrowLeft: [0, -0.18],
  ArrowRight: [0, 0.18],
  ArrowUp: [-0.18, 0],
};

/**
 * A lit, z-buffered torus drawn in glyphs on the CPU. Each sample marches
 * a ray from a perspective camera into the ring, so the silhouette and
 * the hole stay exact at any size. Shading combines a key light, a cool
 * rim light from behind, a tight specular highlight that reaches the
 * densest glyphs, and occlusion inside the ring.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiDonut = ({
  radius = 0.5,
  thickness = 0.46,
  spin = 0.4,
  speed = 1,
  surface = "smooth",
  color = "orange",
  rim = "blue",
  light = 315,
  floor = true,
  draggable = true,
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
}: AsciiDonutProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useAsciiColors(rootRef, [
    "--ascii-ink",
    "--ascii-paper",
    color,
    rim,
  ]);
  const reducedMotion = usePrefersReducedMotion();
  const spinRef = useRef<Spin>({
    clock: 0,
    dragging: false,
    vx: 0,
    vy: 0,
    x: 0,
    y: 0,
  });
  useDragSpin(rootRef, spinRef, draggable);
  const fieldRef = useRef<ToneField | null>(null);
  const matrix = useRef(new Float64Array(9));
  const sample = useRef(new Float64Array(4));

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
  const body = theme?.[2] ? toBytes(theme[2]) : ([240, 140, 60] as Rgb8);
  const rimColor = theme?.[3] ? toBytes(theme[3]) : ([80, 150, 255] as Rgb8);

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
      state.clock += delta * speed;
      if (!state.dragging) {
        state.x = wrap(state.x + state.vx * delta);
        state.y = wrap(state.y + state.vy * delta);
        // Coast after a drag, then ease back to the resting pose.
        const fade = Math.exp(-delta * 1.6);
        const settle = 1 - Math.exp(-delta * 0.7);
        state.vx *= fade;
        state.vy *= fade;
        state.x -= state.x * settle;
        state.y -= state.y * settle;
      }
    } else if (!animate || reducedMotion) {
      state.clock = time * speed;
    }
    const { clock } = state;
    let field = fieldRef.current;
    const [gx, gy] = resolved.grid;
    if (!field || field.width !== columns * gx || field.height !== rows * gy) {
      field = createToneField(columns, rows, resolved, { color: true });
      fieldRef.current = field;
    }
    rotation(
      REST_TILT + TILT_SWAY * Math.sin(clock * 0.31) + state.x,
      TURN_SWAY * Math.sin(clock * 0.19) + state.y,
      spin * clock,
      matrix.current
    );
    const angle = (light * Math.PI) / 180;
    const key = normalize3(Math.sin(angle) * 0.9, Math.cos(angle) * 0.9, -0.75);
    const scene: Scene = {
      back: normalize3(-key[0] * 0.6, -key[1] * 0.4, 0.9),
      body,
      floor,
      half: normalize3(key[0], key[1], key[2] - 1),
      key,
      m: matrix.current,
      ribbed: surface === "ribbed",
      rimColor,
      ring: 1 / (1 + Math.min(0.9, Math.max(0.1, thickness))),
      tube: 0,
    };
    scene.tube = scene.ring * Math.min(0.9, Math.max(0.1, thickness));

    const width = columns * metrics.width;
    const height = rows * metrics.height;
    // Scaled so the ring's centre line, seen face on, spans `radius` of
    // the half-size; perspective shrinks the focal plane by FOCAL / CAMERA.
    const scale =
      ((Math.min(width, height) / 2) * Math.min(0.95, Math.max(0.1, radius))) /
      ((scene.ring * FOCAL) / CAMERA);
    const sampleWidth = metrics.width / gx;
    const sampleHeight = metrics.height / gy;
    const { tones, colors } = field;
    const out = sample.current;
    for (let y = 0; y < field.height; y += 1) {
      const v = (height / 2 - (y + 0.5) * sampleHeight) / scale;
      for (let x = 0; x < field.width; x += 1) {
        const u = ((x + 0.5) * sampleWidth - width / 2) / scale;
        shade(scene, u, v, out);
        if (lumaLimit < 1) {
          capLuma(out, lumaLimit);
        }
        const index = y * field.width + x;
        tones[index] = out[0] ?? 0;
        if (colors && (out[0] ?? 0) > 0) {
          const at = index * 4;
          colors[at] = out[1] ?? 0;
          colors[at + 1] = out[2] ?? 0;
          colors[at + 2] = out[3] ?? 0;
          colors[at + 3] = 255;
        }
      }
    }
    mapTones(field, columns, rows, options, frame);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEYS[event.key];
    if (!(draggable && step)) {
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
        (draggable
          ? "A ring drawn in glyphs, turning slowly. Drag it or use the arrow keys to turn it."
          : "A ring drawn in glyphs, turning slowly.")
      }
      tabIndex={draggable ? 0 : undefined}
      onKeyDown={onKeyDown}
      className={cn(
        "relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring",
        draggable && "cursor-grab touch-pan-y active:cursor-grabbing",
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
