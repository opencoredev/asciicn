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

/** Which way the helix axis runs across the box. */
export const HELIX_ORIENTATIONS = ["vertical", "horizontal"] as const;
export type HelixOrientation = (typeof HELIX_ORIENTATIONS)[number];

/** The four bases. Each rung pairs A with T or G with C. */
export type HelixBase = "A" | "C" | "G" | "T";

export interface DnaHelixProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Turn around the helix axis, in radians per second. Negative turns the other way. Default 0.35. */
  speed?: number;
  /** How tightly the strands wind. 1 is B-DNA's own shape, one turn every 3.4 radii. Default 1. */
  twist?: number;
  /** Base pairs per turn, 4 to 20. Default 10. */
  rungs?: number;
  /** Base pairs per second that slide along the axis. Default 0.5. */
  scroll?: number;
  /** Default `"vertical"`. */
  orientation?: HelixOrientation;
  /** Bases read along one strand and repeated; letters other than A, C, G and T are skipped. Default: a fixed mixed sequence. */
  sequence?: string;
  /** Backbone colour in truecolor. Default `"--ascii-ink"`. */
  color?: AsciiColor;
  /** Base colours in truecolor. Default A `"green"`, T `"pink"`, G `"orange"`, C `"blue"`. */
  baseColors?: Partial<Readonly<Record<HelixBase, AsciiColor>>>;
  /** Drag or use the arrow keys to turn and tilt it. Default `true`. */
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
 * dithering keeps the far strand's soft shading as a stipple.
 */
const packedDither = (look: AsciiLook): "none" | "blue-noise" => {
  const { kind } = resolveCharset(look.charset ?? "braille", look.chars);
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

/* -------------------------------------------------------------------------- */
/* Drag to turn                                                                */
/* -------------------------------------------------------------------------- */

interface Turn {
  /** Angle around the helix axis. */
  spin: number;
  /** Lean of the axis towards or away from the viewer. */
  tilt: number;
  /** Base pairs slid along the axis so far. */
  slide: number;
  /** Extra spin velocity from a drag, decaying back to 0. */
  velocity: number;
  dragging: boolean;
}

const MAX_TILT = 1.1;
const REST_TILT = 0.22;

const clampTilt = (tilt: number) =>
  Math.max(-MAX_TILT, Math.min(MAX_TILT, tilt));

/**
 * Upright, a sideways drag spins the helix and an up and down drag tilts
 * it. Lying down, both directions spin it: a sideways drag screws the
 * strands along under the pointer, so touch scrolling still works. A
 * flick keeps spinning, then fades back to the idle spin.
 */
const useDragTurn = (
  ref: RefObject<HTMLDivElement | null>,
  turn: RefObject<Turn>,
  horizontal: boolean,
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
      // The near side follows the pointer.
      const across = horizontal ? dx - dy : -dx;
      const along = horizontal ? 0 : -dy;
      turn.current.spin += across;
      turn.current.tilt = clampTilt(turn.current.tilt + along);
      turn.current.velocity = across / dt;
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
  }, [ref, turn, horizontal, enabled]);
};

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

// Model units: the helix radius is 1 and its axis is y.
const CAMERA = 7;
const BACKBONE = 0.17;
const RUNG = 0.11;
// Rungs carry the colour, so they sit a step brighter than the backbones.
const BACKBONE_AMBIENT = 0.3;
const RUNG_AMBIENT = 0.42;
// Angle between the two strands at one height. Less than half a turn,
// which opens the wide and narrow grooves that make DNA read as DNA.
const GROOVE = 2.45;
// B-DNA climbs 3.4 radii per turn.
const PITCH = 3.4;
const DEFAULT_SEQUENCE =
  "ATGCGTACCGATTGCAGGCTAACGTTCGGATCCATGAGCTTGACGTAAGCTCGATC";
const PARTNER: Readonly<Record<HelixBase, HelixBase>> = {
  A: "T",
  C: "G",
  G: "C",
  T: "A",
};
const DEFAULT_BASE_COLORS = {
  A: "green",
  C: "blue",
  G: "orange",
  T: "pink",
} as const satisfies Record<HelixBase, AsciiColor>;

const isBase = (letter: string): letter is HelixBase => letter in PARTNER;

const parseSequence = (sequence: string): readonly HelixBase[] => {
  const bases = [...sequence.toUpperCase()].filter(isBase);
  return bases.length > 0 ? bases : [...DEFAULT_SEQUENCE].filter(isBase);
};

/** Key light from the upper left and in front, and its half vector, in view space. */
const LIGHT = (() => {
  const length = Math.hypot(-0.55, 0.62, -0.56);
  return [-0.55 / length, 0.62 / length, -0.56 / length] as const;
})();
const HALF = (() => {
  const [x, y, z] = LIGHT;
  const length = Math.hypot(x, y, z - 1);
  return [x / length, y / length, (z - 1) / length] as const;
})();

/** The sample grid being drawn into, with a depth per sample. */
interface Raster {
  field: ToneField;
  depth: Float32Array;
  /** Sample size in CSS pixels. */
  sampleWidth: number;
  sampleHeight: number;
  /** Box centre and pixels per model unit at the axis. */
  cx: number;
  cy: number;
  unit: number;
  /** Depths of the nearest and farthest strand, for fog. */
  near: number;
  far: number;
  lumaLimit: number;
}

/**
 * Splat one lit sphere at view-space centre (x, y, z), z into the screen.
 * Each sample inside the disc gets the sphere's true surface depth and
 * normal, so overlapping spheres meet in a correct intersection.
 */
const splat = (
  raster: Raster,
  x: number,
  y: number,
  z: number,
  radius: number,
  rgb: Rgb8,
  ambient: number
) => {
  const distance = CAMERA + z;
  if (distance < 0.5) {
    return;
  }
  const scale = (raster.unit * CAMERA) / distance;
  const px = raster.cx + x * scale;
  const py = raster.cy - y * scale;
  const rs = radius * scale;
  const { field, depth, sampleWidth, sampleHeight } = raster;
  const x0 = Math.max(0, Math.floor((px - rs) / sampleWidth));
  const x1 = Math.min(field.width - 1, Math.ceil((px + rs) / sampleWidth));
  const y0 = Math.max(0, Math.floor((py - rs) / sampleHeight));
  const y1 = Math.min(field.height - 1, Math.ceil((py + rs) / sampleHeight));
  if (x0 > x1 || y0 > y1) {
    return;
  }
  // Farther parts of the helix sink towards the paper.
  const fog = Math.max(
    0,
    Math.min(1, (distance - raster.near) / (raster.far - raster.near))
  );
  const dim = 1 - 0.55 * fog;
  const { tones, colors } = field;
  const inverse = 1 / rs;
  for (let sy = y0; sy <= y1; sy += 1) {
    const b = (py - (sy + 0.5) * sampleHeight) * inverse;
    const row = sy * field.width;
    for (let sx = x0; sx <= x1; sx += 1) {
      const a = ((sx + 0.5) * sampleWidth - px) * inverse;
      const q = 1 - a * a - b * b;
      if (q <= 0) {
        continue;
      }
      const nz = -Math.sqrt(q);
      const at = row + sx;
      const surface = distance + radius * nz;
      if (surface >= (depth[at] ?? 0)) {
        continue;
      }
      depth[at] = surface;
      const diffuse = Math.max(0, a * LIGHT[0] + b * LIGHT[1] + nz * LIGHT[2]);
      const specular =
        Math.max(0, a * HALF[0] + b * HALF[1] + nz * HALF[2]) ** 28;
      // A thin bright outline where the surface turns away keeps each
      // strand separate from whatever sits behind it.
      const rim = (1 + nz) ** 3;
      const light = (ambient + 0.62 * diffuse) * dim;
      tones[at] = Math.min(1, light + 0.2 * rim * dim + 0.6 * specular);
      if (colors) {
        const shine = specular * 230;
        const c = at * 4;
        const lit = Math.min(1.15, light * 1.15 + 0.18 * rim);
        let r = rgb[0] * lit + shine;
        let g = rgb[1] * lit + shine;
        let bl = rgb[2] * lit + shine;
        if (raster.lumaLimit < 1) {
          const value = (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255;
          if (value > raster.lumaLimit) {
            const cap = raster.lumaLimit / value;
            r *= cap;
            g *= cap;
            bl *= cap;
          }
        }
        colors[c] = r;
        colors[c + 1] = g;
        colors[c + 2] = bl;
        colors[c + 3] = 255;
      }
    }
  }
};

/**
 * Braille and quadrant cells average the colour of every sample, lit or
 * not. Spread each cell's lit colour over its dark samples so thin rungs
 * keep their full colour instead of fading to grey.
 */
const spreadCellColor = (field: ToneField, gx: number, gy: number) => {
  const { colors, tones, width, height } = field;
  if (!colors || gx * gy === 1) {
    return;
  }
  for (let top = 0; top < height; top += gy) {
    for (let left = 0; left < width; left += gx) {
      let r = 0;
      let g = 0;
      let b = 0;
      let lit = 0;
      for (let dy = 0; dy < gy; dy += 1) {
        for (let dx = 0; dx < gx; dx += 1) {
          const at = (top + dy) * width + left + dx;
          if ((tones[at] ?? 0) > 0) {
            r += colors[at * 4] ?? 0;
            g += colors[at * 4 + 1] ?? 0;
            b += colors[at * 4 + 2] ?? 0;
            lit += 1;
          }
        }
      }
      if (lit === 0 || lit === gx * gy) {
        continue;
      }
      for (let dy = 0; dy < gy; dy += 1) {
        for (let dx = 0; dx < gx; dx += 1) {
          const at = (top + dy) * width + left + dx;
          if ((tones[at] ?? 0) === 0) {
            colors.set([r / lit, g / lit, b / lit, 255], at * 4);
          }
        }
      }
    }
  }
};

/** Object-to-view rotation: spin around y, tilt around x, then lay the axis down if horizontal. */
const rotation = (
  spin: number,
  tilt: number,
  horizontal: boolean,
  into: Float64Array
) => {
  const cs = Math.cos(spin);
  const ss = Math.sin(spin);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  // Rx(tilt) * Ry(spin), row-major.
  const m = [cs, 0, ss, st * ss, ct, -st * cs, -ct * ss, st, ct * cs];
  if (horizontal) {
    // Rz(-90deg): the axis (view y) turns to point right.
    into.set([m[3], m[4], m[5], -m[0], -m[1], -m[2], m[6], m[7], m[8]]);
  } else {
    into.set(m);
  }
};

interface Helix {
  m: Float64Array;
  /** Model units climbed per base pair. */
  rise: number;
  /** Radians turned per base pair. */
  step: number;
  /** Base pairs slid along the axis. */
  slide: number;
  /** Base pair indices to draw, inclusive. */
  first: number;
  last: number;
  bases: readonly HelixBase[];
  backbone: Rgb8;
  palette: Readonly<Record<HelixBase, Rgb8>>;
}

/** Splat a model-space sphere through the helix rotation. */
const place = (
  raster: Raster,
  m: Float64Array,
  x: number,
  y: number,
  z: number,
  radius: number,
  rgb: Rgb8,
  ambient: number
) => {
  splat(
    raster,
    (m[0] ?? 0) * x + (m[1] ?? 0) * y + (m[2] ?? 0) * z,
    (m[3] ?? 0) * x + (m[4] ?? 0) * y + (m[5] ?? 0) * z,
    (m[6] ?? 0) * x + (m[7] ?? 0) * y + (m[8] ?? 0) * z,
    radius,
    rgb,
    ambient
  );
};

const drawHelix = (raster: Raster, helix: Helix) => {
  const { m, rise, step, slide, first, last, bases, backbone, palette } = helix;
  // Backbones: overlapping spheres, close enough to read as a smooth tube,
  // swelling slightly at each base pair like the sugar-phosphate beads.
  const arc = Math.hypot(step, rise);
  const increment = (BACKBONE * 0.45) / arc;
  for (let k = first; k <= last; k += increment) {
    const angle = k * step;
    const y = (k - slide) * rise;
    const bead = Math.cos((k - Math.round(k)) * Math.PI) ** 8;
    const radius = BACKBONE * (0.9 + 0.22 * bead);
    place(
      raster,
      m,
      Math.cos(angle),
      y,
      Math.sin(angle),
      radius,
      backbone,
      BACKBONE_AMBIENT
    );
    place(
      raster,
      m,
      Math.cos(angle + GROOVE),
      y,
      Math.sin(angle + GROOVE),
      radius,
      backbone,
      BACKBONE_AMBIENT
    );
  }
  // Rungs: a chord between the strands, each half in its own base colour,
  // with a hairline gap where the hydrogen bonds hold the pair.
  const count = bases.length;
  for (let k = Math.ceil(first); k <= last; k += 1) {
    const base = bases[((k % count) + count) % count] ?? "A";
    const angle = k * step;
    const y = (k - slide) * rise;
    const ax = Math.cos(angle);
    const az = Math.sin(angle);
    const bx = Math.cos(angle + GROOVE);
    const bz = Math.sin(angle + GROOVE);
    const length = Math.hypot(bx - ax, bz - az);
    const spheres = Math.ceil(length / (RUNG * 0.5));
    for (let i = 0; i <= spheres; i += 1) {
      const t = i / spheres;
      if (Math.abs(t - 0.5) < 0.035) {
        continue;
      }
      const rgb = t < 0.5 ? palette[base] : palette[PARTNER[base]];
      place(
        raster,
        m,
        ax + (bx - ax) * t,
        y,
        az + (bz - az) * t,
        RUNG,
        rgb,
        RUNG_AMBIENT
      );
    }
  }
};

const DEFAULT_COLOR = [210, 210, 210] as const satisfies Rgb8;

const KEYS: Partial<Record<string, readonly [number, number]>> = {
  ArrowDown: [0, -0.15],
  ArrowLeft: [-0.2, 0],
  ArrowRight: [0.2, 0],
  ArrowUp: [0, 0.15],
};

/**
 * A rotating double helix drawn in glyphs on the CPU. Two backbones and
 * the base-pair rungs between them are built from lit spheres splatted
 * into a depth buffer, so strands pass in front of and behind each other
 * exactly. Rungs take one colour per base, and the whole molecule slides
 * slowly along its axis.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const DnaHelix = ({
  speed = 0.35,
  twist = 1,
  rungs = 10,
  scroll = 0.5,
  orientation = "vertical",
  sequence = DEFAULT_SEQUENCE,
  color = "--ascii-ink",
  baseColors,
  interactive = true,
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
}: DnaHelixProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useAsciiColors(rootRef, [
    "--ascii-ink",
    "--ascii-paper",
    color,
    baseColors?.A ?? DEFAULT_BASE_COLORS.A,
    baseColors?.C ?? DEFAULT_BASE_COLORS.C,
    baseColors?.G ?? DEFAULT_BASE_COLORS.G,
    baseColors?.T ?? DEFAULT_BASE_COLORS.T,
  ]);
  const reducedMotion = usePrefersReducedMotion();
  const horizontal = orientation === "horizontal";
  const turnRef = useRef<Turn>({
    dragging: false,
    slide: 0,
    spin: 0,
    // Upright, lean the top away a little so the rungs open into ellipses.
    tilt: horizontal ? 0 : REST_TILT,
    velocity: 0,
  });
  useDragTurn(rootRef, turnRef, horizontal, interactive);
  useEffect(() => {
    turnRef.current.tilt = horizontal ? 0 : REST_TILT;
  }, [horizontal]);
  const fieldRef = useRef<ToneField | null>(null);
  const depthRef = useRef(new Float32Array(0));
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
  const bases = parseSequence(sequence);
  const backbone = theme?.[2] ? toBytes(theme[2]) : DEFAULT_COLOR;
  const palette: Record<HelixBase, Rgb8> = {
    A: theme?.[3] ? toBytes(theme[3]) : [80, 200, 120],
    C: theme?.[4] ? toBytes(theme[4]) : [90, 160, 255],
    G: theme?.[5] ? toBytes(theme[5]) : [250, 160, 70],
    T: theme?.[6] ? toBytes(theme[6]) : [240, 110, 170],
  };
  const perTurn = Math.max(4, Math.min(20, rungs));
  const pitch = PITCH / Math.max(0.2, Math.min(4, twist));

  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    delta,
    time,
  }: AsciiGridDrawContext) => {
    const state = turnRef.current;
    if (delta > 0) {
      state.slide += scroll * delta;
      if (!state.dragging) {
        state.spin += (speed + state.velocity) * delta;
        // Coast after a flick, then settle back to the idle spin.
        state.velocity *= Math.exp(-delta * 1.4);
      }
    } else if (!(animate && !reducedMotion) && !state.dragging) {
      state.spin = speed * time + 0.6;
      state.slide = scroll * time;
    }

    let field = fieldRef.current;
    const [gx, gy] = resolved.grid;
    if (!field || field.width !== columns * gx || field.height !== rows * gy) {
      field = createToneField(columns, rows, resolved, { color: true });
      fieldRef.current = field;
      depthRef.current = new Float32Array(field.width * field.height);
    }
    field.tones.fill(0);
    field.colors?.fill(0);
    depthRef.current.fill(Number.POSITIVE_INFINITY);

    const width = columns * metrics.width;
    const height = rows * metrics.height;
    const across = horizontal ? height : width;
    const along = horizontal ? width : height;
    // Fit the width of the helix to the box, but always show over a turn.
    const unit = Math.max(4, Math.min(across * 0.23, along * 0.16));
    const reach = (along / 2 / unit) * 1.3 + 1;
    const rise = pitch / perTurn;
    rotation(state.spin, state.tilt, horizontal, matrix.current);
    const raster: Raster = {
      cx: width / 2,
      cy: height / 2,
      depth: depthRef.current,
      far: CAMERA + 1.2,
      field,
      lumaLimit,
      near: CAMERA - 1.2,
      sampleHeight: metrics.height / gy,
      sampleWidth: metrics.width / gx,
      unit,
    };
    drawHelix(raster, {
      backbone,
      bases,
      first: Math.floor(state.slide - reach / rise),
      last: Math.ceil(state.slide + reach / rise),
      m: matrix.current,
      palette,
      rise,
      slide: state.slide,
      step: (Math.PI * 2) / perTurn,
    });
    spreadCellColor(field, gx, gy);
    mapTones(field, columns, rows, options, frame);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEYS[event.key];
    if (!(interactive && step)) {
      return;
    }
    event.preventDefault();
    turnRef.current.spin += step[0];
    turnRef.current.tilt = clampTilt(turnRef.current.tilt + step[1]);
  };

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={
        ariaLabel ??
        (interactive
          ? "A turning DNA double helix drawn in glyphs. Drag it or use the arrow keys to turn it."
          : "A turning DNA double helix drawn in glyphs.")
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
