"use client";

import { useEffect, useRef } from "react";
import type { ComponentProps, KeyboardEvent, RefObject } from "react";

import { landCoverage } from "@/components/asciicn/world-land";
import type { LatLon } from "@/components/asciicn/world-land";
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
  MutableFrame,
  Rgb8,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

export type { LatLon } from "@/components/asciicn/world-land";

/** A pulsing location on the globe. */
export interface GlobeMarker {
  /** `[lat, lon]` in degrees. */
  at: LatLon;
  /** Default: the globe's `accent`. */
  color?: AsciiColor;
}

/** A dotted arc that lifts off the surface between two places. */
export interface GlobeArc {
  from: LatLon;
  to: LatLon;
  /** Default: the globe's `accent`. */
  color?: AsciiColor;
}

export interface AsciiGlobeProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Land colour in truecolor. Default `"green"`. */
  color?: AsciiColor;
  /** Sea and atmosphere colour in truecolor. Default `"blue"`. */
  oceanColor?: AsciiColor;
  /** Markers and arcs that don't set their own colour. Default `"orange"`. */
  accent?: AsciiColor;
  /** Locations to mark. Markers on the far side are hidden. */
  markers?: readonly GlobeMarker[];
  /** Connections between places, lifted off the surface. */
  arcs?: readonly GlobeArc[];
  /** Degrees of rotation per second. Negative spins the other way. Default 6. */
  speed?: number;
  /** Longitude facing the viewer at the start, in degrees. Default 10. */
  start?: number;
  /** How far the north pole leans towards the viewer, in degrees. Default 18. */
  tilt?: number;
  /** Where the sun is, in degrees clockwise from the top. Default 300 (upper left). */
  light?: number;
  /** Brightness of the sea on the day side, 0 to 1. Default 0.3. */
  ocean?: number;
  /** A glow around the lit limb. Default `true`. */
  atmosphere?: boolean;
  /** Faint latitude and longitude lines every 30°. Default `false`. */
  graticule?: boolean;
  /** Drag or use the arrow keys to turn and tilt it; it coasts after a drag. Default `true`. */
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
    lumaLimit: lightPaper ? 0.26 : 1,
    options,
    paper: transparent ? ("transparent" as const) : paper,
  };
};

/* -------------------------------------------------------------------------- */
/* Turning                                                                     */
/* -------------------------------------------------------------------------- */

interface Turn {
  /** Longitude facing the viewer, in degrees. */
  lon: number;
  /** Tilt in degrees. */
  tilt: number;
  /** Extra spin from a drag, degrees per second, fading to 0. */
  velocity: number;
  dragging: boolean;
}

const MAX_TILT = 70;

/** Horizontal drags spin, vertical drags tilt; a flick coasts and fades. */
const useGlobeDrag = (
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
      // Degrees per pixel so the land stays roughly under the pointer.
      const perPixel =
        120 / Math.max(120, Math.min(root.clientWidth, root.clientHeight));
      const dx = (event.clientX - last.x) * perPixel;
      const dy = (event.clientY - last.y) * perPixel;
      const dt = Math.max(1, event.timeStamp - last.t) / 1000;
      turn.current.lon -= dx;
      turn.current.tilt = Math.max(
        -MAX_TILT,
        Math.min(MAX_TILT, turn.current.tilt + dy)
      );
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

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

const RADIANS = Math.PI / 180;
// Globe radius as a share of half the box's shorter side; the rest is halo.
const RADIUS_SHARE = 0.86;
const HALO = 0.07;
const PULSE = 4;

const clamp01 = (value: number) => (value > 0 ? Math.min(value, 1) : 0);

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

interface Colors {
  land: Rgb8;
  sea: Rgb8;
  accent: Rgb8;
}

interface View {
  /** Centre and radius in CSS pixels. */
  cx: number;
  cy: number;
  radius: number;
  lon: number;
  sinTilt: number;
  cosTilt: number;
  /** Sun direction and the half vector to the viewer, in view space (z towards the viewer). */
  sun: readonly [number, number, number];
  half: readonly [number, number, number];
}

interface Paint {
  ocean: number;
  atmosphere: boolean;
  graticule: boolean;
  colors: Colors;
}

/** Tone and colour of one sample at (u, v), in globe radii from the centre, y up. */
const shadeGlobe = (
  view: View,
  paint: Paint,
  u: number,
  v: number,
  out: Float64Array
) => {
  const r2 = u * u + v * v;
  const [lx, ly, lz] = view.sun;
  const { land: landRgb, sea } = paint.colors;
  out[0] = 0;
  if (r2 > 1) {
    if (!paint.atmosphere) {
      return;
    }
    const r = Math.sqrt(r2);
    if (r > 1 + HALO * 2.5) {
      return;
    }
    const lit = smoothstep(-0.35, 0.7, (u * lx + v * ly) / r);
    const glow = Math.exp(-(r - 1) / HALO) * (0.12 + 0.88 * lit);
    out[0] = glow * 0.5;
    [out[1], out[2], out[3]] = sea;
    return;
  }
  const z = Math.sqrt(1 - r2);
  // View normal (u, v, z) back into the globe's own frame.
  const gy = v * view.cosTilt + z * view.sinTilt;
  const gz = -v * view.sinTilt + z * view.cosTilt;
  const lat = Math.asin(Math.max(-1, Math.min(1, gy))) / RADIANS;
  const lon = view.lon + Math.atan2(u, gz) / RADIANS;
  const land = smoothstep(0.3, 0.7, landCoverage(lat, lon));

  const light = u * lx + v * ly + z * lz;
  const day = smoothstep(-0.12, 0.22, light);
  const lit = Math.max(0, light);
  const [hx, hy, hz] = view.half;
  const glint = Math.max(0, u * hx + v * hy + z * hz) ** 70 * (1 - land) * day;
  // Thicker air at the limb lifts the lit edge.
  const limb = (1 - z) ** 3 * day;

  const ice = smoothstep(68, 78, Math.abs(lat)) * land;
  let landTone = day * (0.34 + 0.62 * lit ** 0.8) + (1 - day) * 0.09;
  landTone += ice * 0.15 * day;
  const seaTone = day * paint.ocean * (0.35 + 0.65 * lit) + (1 - day) * 0.015;
  let tone = land * landTone + (1 - land) * seaTone + glint * 0.9 + limb * 0.35;

  let grid = 0;
  if (paint.graticule) {
    const latLine = Math.abs(((lat + 90) % 30) - 15) > 14.2 ? 1 : 0;
    const lonLine =
      Math.abs((((lon % 30) + 30) % 30) - 15) >
      15 - 0.8 / Math.max(0.15, Math.cos(lat * RADIANS))
        ? 1
        : 0;
    grid = Math.max(latLine, lonLine) * (1 - land) * 0.16;
    tone = Math.max(tone, grid);
  }
  out[0] = clamp01(tone);

  // Colour: land and sea by daylight, ice towards white, glints and limb light.
  const shadeLand = 0.25 + 0.9 * day * (0.4 + 0.6 * lit);
  const shadeSea = 0.18 + 0.75 * day * (0.35 + 0.65 * lit);
  const mixIce = ice * 0.8;
  for (let channel = 0; channel < 3; channel += 1) {
    const landChannel =
      ((landRgb[channel] ?? 0) * (1 - mixIce) + 235 * mixIce) * shadeLand;
    const seaChannel = (sea[channel] ?? 0) * shadeSea;
    out[channel + 1] = Math.min(
      255,
      land * landChannel +
        (1 - land) * seaChannel +
        glint * 255 +
        limb * (sea[channel] ?? 0) * 0.6 +
        grid * (sea[channel] ?? 0)
    );
  }
};

/** A point at `lat`, `lon`, lifted to `height` radii, in view space. */
const project = (
  view: View,
  [lat, lon]: LatLon,
  height = 1
): readonly [number, number, number] => {
  const phi = lat * RADIANS;
  const lambda = (lon - view.lon) * RADIANS;
  const x = Math.cos(phi) * Math.sin(lambda) * height;
  const y = Math.sin(phi) * height;
  const z = Math.cos(phi) * Math.cos(lambda) * height;
  return [
    x,
    y * view.cosTilt - z * view.sinTilt,
    y * view.sinTilt + z * view.cosTilt,
  ];
};

/** Hidden by the globe: behind it and inside its disc. */
const occluded = ([x, y, z]: readonly [number, number, number]) =>
  z < 0 && x * x + y * y < 1;

const toUnit = ([lat, lon]: LatLon): readonly [number, number, number] => [
  Math.cos(lat * RADIANS) * Math.cos(lon * RADIANS),
  Math.cos(lat * RADIANS) * Math.sin(lon * RADIANS),
  Math.sin(lat * RADIANS),
];

/** A point `t` of the way along the great circle from `a` to `b`. */
const slerp = (a: LatLon, b: LatLon, t: number): LatLon => {
  const p = toUnit(a);
  const q = toUnit(b);
  const dot = Math.max(
    -1,
    Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])
  );
  const omega = Math.acos(dot);
  if (omega < 1e-6) {
    return a;
  }
  const sin = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sin;
  const wb = Math.sin(t * omega) / sin;
  const x = p[0] * wa + q[0] * wb;
  const y = p[1] * wa + q[1] * wb;
  const z = p[2] * wa + q[2] * wb;
  return [
    Math.atan2(z, Math.hypot(x, y)) / RADIANS,
    Math.atan2(y, x) / RADIANS,
  ];
};

interface Overlay {
  frame: MutableFrame;
  view: View;
  cellWidth: number;
  cellHeight: number;
}

const plot = (
  { frame, view, cellWidth, cellHeight }: Overlay,
  point: readonly [number, number, number],
  glyph: string,
  rgb: Rgb8
) => {
  const x = view.cx + point[0] * view.radius;
  const y = view.cy - point[1] * view.radius;
  frame.put(Math.floor(x / cellWidth), Math.floor(y / cellHeight), glyph, rgb);
};

const ARC_POINTS = 56;

const drawArcs = (
  overlay: Overlay,
  arcs: readonly GlobeArc[],
  colorOf: (color: AsciiColor | undefined) => Rgb8,
  time: number
) => {
  for (const [index, arc] of arcs.entries()) {
    const rgb = colorOf(arc.color);
    const [ax, ay, az] = toUnit(arc.from);
    const [bx, by, bz] = toUnit(arc.to);
    // Longer arcs fly higher.
    const span = Math.acos(
      Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))
    );
    const lift = 0.06 + 0.22 * (span / Math.PI);
    // One slow packet per arc, about eight seconds a lap.
    const head = (time * 0.18 + index * 0.29) % 1.4;
    for (let step = 0; step <= ARC_POINTS; step += 1) {
      const t = step / ARC_POINTS;
      const point = project(
        overlay.view,
        slerp(arc.from, arc.to, t),
        1 + lift * Math.sin(Math.PI * t)
      );
      if (occluded(point)) {
        continue;
      }
      const near = head - t;
      let glyph = "·";
      if (near >= 0 && near < 0.05) {
        glyph = "•";
      } else if (near >= 0.05 && near < 0.14) {
        glyph = "∙";
      } else if (step % 2 === 1) {
        continue;
      }
      plot(overlay, point, glyph, rgb);
    }
  }
};

const drawMarkers = (
  overlay: Overlay,
  markers: readonly GlobeMarker[],
  colorOf: (color: AsciiColor | undefined) => Rgb8,
  time: number
) => {
  const { view, cellWidth } = overlay;
  for (const [index, marker] of markers.entries()) {
    const point = project(view, marker.at);
    if (point[2] <= 0.02) {
      continue;
    }
    const rgb = colorOf(marker.color);
    // A ring of dots that grows and fades, flattened towards the limb.
    const phase = (time / PULSE + index * 0.37) % 1;
    const ring = (phase * 3.2 * cellWidth) / view.radius;
    if (phase < 0.8) {
      const dots = 14;
      for (let dot = 0; dot < dots; dot += 1) {
        const angle = (dot / dots) * Math.PI * 2;
        plot(
          overlay,
          [
            point[0] + Math.cos(angle) * ring * point[2],
            point[1] + Math.sin(angle) * ring,
            point[2],
          ],
          phase < 0.45 ? "∙" : "·",
          rgb
        );
      }
    }
    plot(overlay, point, "●", rgb);
  }
};

const KEYS: Partial<Record<string, readonly [number, number]>> = {
  ArrowDown: [0, -6],
  ArrowLeft: [8, 0],
  ArrowRight: [-8, 0],
  ArrowUp: [0, 6],
};

const NO_MARKERS: readonly GlobeMarker[] = [];
const NO_ARCS: readonly GlobeArc[] = [];

/**
 * A lit, rotating planet in glyphs, drawn on the CPU: every sample casts
 * a ray at the sphere and reads land from the `world-land` mask. The sun
 * draws a soft terminator, the night side keeps a faint outline of the
 * land, the sea catches a specular glint, and the lit limb glows.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const AsciiGlobe = ({
  color = "green",
  oceanColor = "blue",
  accent = "orange",
  markers = NO_MARKERS,
  arcs = NO_ARCS,
  speed = 6,
  start = 10,
  tilt = 18,
  light = 300,
  ocean = 0.3,
  atmosphere = true,
  graticule = false,
  draggable = true,
  cell = 10,
  animate = true,
  handle,
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
  background,
  fx,
  className,
  "aria-label": ariaLabel,
  ...props
}: AsciiGlobeProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const markerColors = [
    ...new Set([...markers, ...arcs].map((item) => item.color ?? accent)),
  ];
  const theme = useAsciiColors(rootRef, [
    "--ascii-ink",
    "--ascii-paper",
    color,
    oceanColor,
    accent,
    ...markerColors,
  ]);
  const reducedMotion = usePrefersReducedMotion();
  const turnRef = useRef<Turn>({
    dragging: false,
    lon: start,
    tilt,
    velocity: 0,
  });
  useGlobeDrag(rootRef, turnRef, draggable);
  // A new start or tilt from props moves the globe there.
  useEffect(() => {
    turnRef.current.lon = start;
  }, [start]);
  useEffect(() => {
    turnRef.current.tilt = tilt;
  }, [tilt]);
  const fieldRef = useRef<ToneField | null>(null);
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
  const colors: Colors = {
    accent: theme?.[4] ? toBytes(theme[4]) : [255, 150, 60],
    land: theme?.[2] ? toBytes(theme[2]) : [90, 200, 120],
    sea: theme?.[3] ? toBytes(theme[3]) : [70, 140, 255],
  };
  const colorOf = (value: AsciiColor | undefined): Rgb8 => {
    const at = markerColors.indexOf(value ?? accent);
    const resolvedColor = at === -1 ? undefined : theme?.[5 + at];
    return resolvedColor ? toBytes(resolvedColor) : colors.accent;
  };

  // oxlint-disable-next-line complexity -- one pass per frame: turning, view setup, the sample loop and overlays read best together.
  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    delta,
    time,
  }: AsciiGridDrawContext) => {
    const turn = turnRef.current;
    if (!turn.dragging && delta > 0) {
      turn.lon -= (speed + turn.velocity) * delta;
      turn.velocity *= Math.exp(-delta * 1.4);
    }
    const [gx, gy] = resolved.grid;
    let field = fieldRef.current;
    if (!field || field.width !== columns * gx || field.height !== rows * gy) {
      field = createToneField(columns, rows, resolved, { color: true });
      fieldRef.current = field;
    }
    const width = columns * metrics.width;
    const height = rows * metrics.height;
    const box = rootRef.current;
    // Centre on the element, not the grid, which overshoots by part of a cell.
    const boxWidth = box?.clientWidth || width;
    const boxHeight = box?.clientHeight || height;
    const angle = light * RADIANS;
    const sun = [Math.sin(angle) * 0.82, Math.cos(angle) * 0.82, 0.58] as const;
    const halfLength = Math.hypot(sun[0], sun[1], sun[2] + 1);
    const view: View = {
      cosTilt: Math.cos(turn.tilt * RADIANS),
      cx: boxWidth / 2,
      cy: boxHeight / 2,
      half: [
        sun[0] / halfLength,
        sun[1] / halfLength,
        (sun[2] + 1) / halfLength,
      ],
      lon: turn.lon,
      radius: (Math.min(boxWidth, boxHeight) / 2) * RADIUS_SHARE,
      sinTilt: Math.sin(turn.tilt * RADIANS),
      sun,
    };
    const paint: Paint = { atmosphere, colors, graticule, ocean };
    const sampleWidth = metrics.width / gx;
    const sampleHeight = metrics.height / gy;
    const { tones } = field;
    const fieldColors = field.colors;
    const out = sample.current;
    for (let y = 0; y < field.height; y += 1) {
      const v = (view.cy - (y + 0.5) * sampleHeight) / view.radius;
      for (let x = 0; x < field.width; x += 1) {
        const u = ((x + 0.5) * sampleWidth - view.cx) / view.radius;
        shadeGlobe(view, paint, u, v, out);
        if (lumaLimit < 1) {
          capLuma(out, lumaLimit);
        }
        const index = y * field.width + x;
        tones[index] = out[0] ?? 0;
        if (fieldColors && (out[0] ?? 0) > 0) {
          const at = index * 4;
          fieldColors[at] = out[1] ?? 0;
          fieldColors[at + 1] = out[2] ?? 0;
          fieldColors[at + 2] = out[3] ?? 0;
          fieldColors[at + 3] = 255;
        }
      }
    }
    mapTones(field, columns, rows, options, frame);
    if (markers.length > 0 || arcs.length > 0) {
      // Markers keep their accent even in mono, so give the frame colour.
      frame.setColored(true);
      const overlay = {
        cellHeight: metrics.height,
        cellWidth: metrics.width,
        frame,
        view,
      };
      const clock = animate && !reducedMotion ? time : 1.2;
      drawArcs(overlay, arcs, colorOf, clock);
      drawMarkers(overlay, markers, colorOf, clock);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEYS[event.key];
    if (!(draggable && step)) {
      return;
    }
    event.preventDefault();
    turnRef.current.lon += step[0];
    turnRef.current.tilt = Math.max(
      -MAX_TILT,
      Math.min(MAX_TILT, turnRef.current.tilt + step[1])
    );
  };

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={
        ariaLabel ??
        (draggable
          ? "Globe. Drag it or use the arrow keys to turn it."
          : "Globe")
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
        colored={colorMode !== "mono" || markers.length > 0 || arcs.length > 0}
        animate={animate}
        fps={60}
        handle={handle}
        className="absolute inset-0"
      />
      {fx ? <CrtOverlay fx={fx} /> : null}
    </div>
  );
};
