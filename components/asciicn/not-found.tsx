"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ComponentProps, ReactNode, RefObject } from "react";

import {
  AsciiGrid,
  createToneField,
  cssColor,
  hexToRgb,
  mapTones,
  PHOSPHORS,
  RAMPS,
  readFont,
  resolveCharset,
  useAsciiColors,
  useDocumentVisible,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiHandle,
  AsciiLook,
  Charset,
  MapOptions,
  Rgb8,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

export interface NotFoundProps
  extends AsciiLook, Omit<ComponentProps<"div">, "title" | "color"> {
  /** Glyphs the sand is drawn with. Default `"braille"`. */
  charset?: AsciiLook["charset"];
  /** `truecolor` draws the sand in ink and the grains in `accent`; `mono` draws both in ink. Default `"truecolor"`. */
  colorMode?: AsciiLook["colorMode"];
  /** Ordered dithering. Default `"blue-noise"` for Braille and quadrants, `"none"` for ramps. */
  dither?: AsciiLook["dither"];
  /** The code drawn in sand. Default `"404"`. */
  code?: string;
  /** The heading under the art. Default `"Page not found"`. */
  title?: ReactNode;
  /** One or two sentences under the heading. Default: a line about a moved or mistyped link. */
  description?: ReactNode;
  /** The path echoed in the terminal line. Default: `window.location.pathname`, read after mount. */
  path?: string;
  /** The command typed before the path. Default `"cd"`. */
  command?: string;
  /** The error the command prints. Default `"no such file or directory"`. */
  message?: string;
  /** Buttons or links, laid out in a centred row. */
  actions?: ReactNode;
  /** Heading level of the title. Default `"h1"`. */
  titleAs?: "h1" | "h2" | "h3" | "p";
  /** Colour of the drifting grains, the prompt and the cursor. Default `"orange"`. */
  accent?: AsciiColor;
  /** How hard the wind blows, from 0 (still sand) to 2. Default 1. */
  wind?: number;
  /** A smaller layout for cards and panels. Default `false`. */
  compact?: boolean;
  /** Glyph cell height of the art in CSS pixels. Default 10, or 8 when compact. */
  cell?: number;
  /** Time multiplier. Default 1. */
  speed?: number;
  /** `false` holds a still frame and a still cursor. Default `true`. */
  animate?: boolean;
  /** Frame rate cap. Default 30. */
  fps?: number;
  /** The moment drawn when motion is off or reduced, in seconds. Default 5.5. */
  stillTime?: number;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

/* -------------------------------------------------------------------------- */
/* The dune                                                                    */
/* -------------------------------------------------------------------------- */

const TAU = Math.PI * 2;
/** One loop of the wind in seconds. Gusts, ripples and grains all repeat on it. */
const LOOP = 16;
/** The share of a grain's cycle it spends in the air; the rest it rests. */
const FLIGHT = 0.46;
const MAX_GRAINS = 1600;
// Coverage is averaged over this many pixels per sample side, so the
// digits' curves land on the right glyph level.
const SUPERSAMPLE = 3;
const MAX_SAMPLE_PIXELS = 3_000_000;

// A float hash in [0, 1): stable for integer inputs, no bitwise maths.
const hash = (a: number, b: number): number => {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** A grain that lifts off an exposed edge, drifts downwind and settles. */
interface Grain {
  /** Sample index it lifts from. */
  readonly home: number;
  /** Where it starts, in CSS pixels. */
  readonly x: number;
  readonly y: number;
  /** How far it travels downwind at `wind` 1, in CSS pixels. */
  readonly drift: number;
  /** How high its arc rises, in CSS pixels. */
  readonly lift: number;
  /** Flights per loop: 1, 2 or 3, so every grain repeats on the loop. */
  readonly rate: number;
  readonly phase: number;
  readonly sway: number;
}

interface Dune {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  /** Samples per cell, across and down. */
  readonly gx: number;
  readonly gy: number;
  /** One sample's size in CSS pixels. */
  readonly sx: number;
  readonly sy: number;
  readonly artWidth: number;
  readonly artHeight: number;
  /** Ink coverage of the digits per sample, 0 to 1. */
  readonly mask: Float32Array;
  /** Distance to the nearest empty sample, in CSS pixels. */
  readonly depth: Float32Array;
  /** Per-sample constants: the ripple's phase and a jitter in [0, 1). */
  readonly ripple: Float32Array;
  readonly jitter: Float32Array;
  readonly grains: readonly Grain[];
}

/** Lay the code into an offscreen canvas and read its coverage per sample. */
const rasterize = (
  code: string,
  font: string,
  width: number,
  height: number,
  artWidth: number,
  artHeight: number
): Float32Array | null => {
  const mask = new Float32Array(width * height);
  const scale = Math.max(
    1,
    Math.min(
      SUPERSAMPLE,
      Math.floor(Math.sqrt(MAX_SAMPLE_PIXELS / Math.max(1, width * height)))
    )
  );
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width === 0 || canvas.height === 0) {
    return null;
  }
  // Fit the code to the box at a probe size: wide enough to read, with
  // room to the right for the grains, and short enough to keep a margin.
  context.font = `800 100px ${font}`;
  const probe = context.measureText(code);
  const probeWidth = Math.max(1, probe.width);
  const probeHeight = Math.max(
    1,
    probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent
  );
  const px = Math.min(
    (artWidth * 0.8 * 100) / probeWidth,
    (artHeight * 0.84 * 100) / probeHeight
  );
  // Sample cells are not square, so the two axes scale differently.
  context.setTransform(
    canvas.width / artWidth,
    0,
    0,
    canvas.height / artHeight,
    0,
    0
  );
  context.font = `800 ${px}px ${font}`;
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  const box = context.measureText(code);
  const textHeight = box.actualBoundingBoxAscent + box.actualBoundingBoxDescent;
  const baseline = (artHeight - textHeight) / 2 + box.actualBoundingBoxAscent;
  context.fillText(code, artWidth / 2, baseline);
  // A mono face's bold is thin for a banner: an outline of the same ink
  // gives the strokes enough body to erode without breaking.
  context.strokeStyle = "#fff";
  context.lineJoin = "round";
  context.lineWidth = px * 0.05;
  context.strokeText(code, artWidth / 2, baseline);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const area = scale * scale * 255;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let dy = 0; dy < scale; dy += 1) {
        const start = ((y * scale + dy) * canvas.width + x * scale) * 4 + 3;
        for (let dx = 0; dx < scale; dx += 1) {
          sum += data[start + dx * 4] ?? 0;
        }
      }
      mask[y * width + x] = sum / area;
    }
  }
  return mask;
};

/** Chamfer distance from every inked sample to the nearest empty one. */
const distanceToEmpty = (
  mask: Float32Array,
  width: number,
  height: number,
  sx: number,
  sy: number
) => {
  const depth = new Float32Array(width * height);
  const far = (width + height) * (sx + sy);
  for (let index = 0; index < depth.length; index += 1) {
    depth[index] = (mask[index] ?? 0) >= 0.5 ? far : 0;
  }
  const diagonal = Math.hypot(sx, sy);
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height
      ? 0
      : (depth[y * width + x] ?? 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const self = depth[index] ?? 0;
      if (self > 0) {
        depth[index] = Math.min(
          self,
          at(x - 1, y) + sx,
          at(x, y - 1) + sy,
          at(x - 1, y - 1) + diagonal,
          at(x + 1, y - 1) + diagonal
        );
      }
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      const self = depth[index] ?? 0;
      if (self > 0) {
        depth[index] = Math.min(
          self,
          at(x + 1, y) + sx,
          at(x, y + 1) + sy,
          at(x + 1, y + 1) + diagonal,
          at(x - 1, y + 1) + diagonal
        );
      }
    }
  }
  return depth;
};

interface DuneOptions {
  readonly code: string;
  readonly font: string;
  readonly columns: number;
  readonly rows: number;
  readonly set: Charset;
  readonly cellWidth: number;
  readonly cellHeight: number;
}

const buildDune = (key: string, options: DuneOptions): Dune | null => {
  const { code, font, columns, rows, set, cellWidth, cellHeight } = options;
  const [gx, gy] = set.grid;
  const width = columns * gx;
  const height = rows * gy;
  const sx = cellWidth / gx;
  const sy = cellHeight / gy;
  const artWidth = columns * cellWidth;
  const artHeight = rows * cellHeight;
  const mask = rasterize(code, font, width, height, artWidth, artHeight);
  if (!mask) {
    return null;
  }
  const depth = distanceToEmpty(mask, width, height, sx, sy);
  const ripple = new Float32Array(width * height);
  const jitter = new Float32Array(width * height);
  // Wind ripples: parallel bands tilted a little off vertical, bent by
  // two slow waves so they read as sand rather than stripes.
  const wavelength = Math.max(sy * 5, artHeight * 0.13);
  const sites: number[] = [];
  const grain = Math.max(sx, sy);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const px = (x + 0.5) * sx;
      const py = (y + 0.5) * sy;
      const bend =
        0.9 * Math.sin(py / (artHeight * 0.21) + px / (artWidth * 0.33)) +
        0.5 * Math.sin(px / (artWidth * 0.11) + 1.7);
      ripple[index] = (TAU * (px * 0.94 - py * 0.34)) / wavelength + bend;
      jitter[index] = hash(x, y);
      // Grains lift off the crests and the lee faces: inked samples on
      // the surface with open air above them or downwind of them.
      if ((mask[index] ?? 0) >= 0.5 && (depth[index] ?? 0) <= grain * 1.5) {
        const above = y === 0 ? 0 : (mask[index - width] ?? 0);
        const right = x === width - 1 ? 0 : (mask[index + 1] ?? 0);
        // Lee faces twice over: their grains stream into open air.
        if (right < 0.5) {
          sites.push(index, index);
        } else if (above < 0.5) {
          sites.push(index);
        }
      }
    }
  }
  const count = Math.min(MAX_GRAINS, Math.round(sites.length * 0.6));
  const grains: Grain[] = [];
  for (let j = 0; j < count; j += 1) {
    const home =
      sites[Math.floor(hash(j, 1.3) * sites.length)] ?? sites[0] ?? 0;
    const spread = hash(j, 2.1);
    grains.push({
      drift: artHeight * (0.1 + 0.55 * spread * spread),
      home,
      lift: artHeight * (0.015 + 0.07 * hash(j, 3.7)),
      phase: hash(j, 4.9),
      rate: 1 + Math.floor(hash(j, 5.3) * 3),
      sway: hash(j, 6.1),
      x: ((home % width) + 0.5) * sx,
      y: (Math.floor(home / width) + 0.5) * sy,
    });
  }
  return {
    artHeight,
    artWidth,
    depth,
    grains,
    gx,
    gy,
    height,
    jitter,
    key,
    mask,
    ripple,
    sx,
    sy,
    width,
  };
};

interface Palette {
  readonly ink: Rgb8;
  readonly accent: Rgb8;
}

/**
 * A cell takes the average colour of all its samples, so one amber grain
 * among seven ink samples would read as ink. A cell a grain flies through
 * takes the accent whole: the sand glints where it moves.
 */
const tintCell = (
  { gx, gy, width }: Dune,
  colors: Uint8ClampedArray,
  xi: number,
  yi: number,
  [r, g, b]: Rgb8
) => {
  const left = xi - (xi % gx);
  const top = yi - (yi % gy);
  for (let dy = 0; dy < gy; dy += 1) {
    for (let dx = 0; dx < gx; dx += 1) {
      const at = ((top + dy) * width + left + dx) * 4;
      colors[at] = r;
      colors[at + 1] = g;
      colors[at + 2] = b;
    }
  }
};

/** The sand: a gust sweeps downwind and wears into the surface. */
const fillSand = (
  dune: Dune,
  field: ToneField,
  t: number,
  strength: number,
  ink: Rgb8
) => {
  const { width, height, sx, sy, mask, depth, ripple, jitter, artWidth } = dune;
  const { tones, colors } = field;
  const grain = Math.max(sx, sy);
  // Erosion is measured in art units, not samples: a one-sample ramp cell
  // is far coarser than a Braille dot, and would lose whole strokes.
  const unit = Math.min(grain, dune.artHeight * 0.012);
  const thin = Math.max(grain * 1.5, dune.artHeight * 0.05);
  const cycle = (TAU * t) / LOOP;
  for (let y = 0; y < height; y += 1) {
    const py = (y + 0.5) * sy;
    const tilt = 1.3 * Math.sin(py / (dune.artHeight * 0.18) + 1.7);
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const m = mask[index] ?? 0;
      let tone = 0;
      if (m > 0.02) {
        const d = depth[index] ?? 0;
        // Two gusts per loop, travelling downwind across the code.
        const front = ((x + 0.5) * sx * TAU * 1.4) / artWidth - cycle * 2;
        const gust = (0.5 + 0.5 * Math.cos(front + tilt)) ** 3;
        const jit = jitter[index] ?? 0;
        const reach = unit * (0.35 + strength * 2.3 * gust) * (0.5 + jit);
        const eroded = Math.min(1, Math.max(0, (d - reach) / grain + 0.5));
        // Ripples migrate one wavelength per loop.
        const band = Math.cos((ripple[index] ?? 0) - cycle);
        const trough = smoothstep(0.86, 0.97, band);
        // Thinner toward the surface, so the edges read as loose grains.
        const shade = 0.42 + 0.58 * smoothstep(0, thin, d - reach);
        tone = m * eroded * shade * (1 - 0.6 * trough);
      }
      tones[index] = tone;
      if (colors) {
        const at = index * 4;
        [colors[at], colors[at + 1], colors[at + 2]] = ink;
        colors[at + 3] = 255;
      }
    }
  }
};

/**
 * The grains: each lifts off an edge, arcs downwind and fades as it
 * settles, and the hole it leaves fills back in as it lands.
 */
const flyGrains = (
  dune: Dune,
  field: ToneField,
  t: number,
  strength: number,
  accent: Rgb8,
  grainTone: number
) => {
  const { width, height, sx, sy, mask } = dune;
  const { tones, colors } = field;
  const lift = Math.min(1.4, 0.6 + strength * 0.4);
  const splat = (at: number, value: number) => {
    tones[at] = Math.max(tones[at] ?? 0, value);
  };
  for (const g of dune.grains) {
    const p = (((t * g.rate) / LOOP + g.phase) % 1) / FLIGHT;
    if (p >= 1) {
      continue;
    }
    // Eases off the surface and down again, never a sudden jump.
    const progress = p - Math.sin(TAU * p) / TAU;
    const alpha = smoothstep(0, 0.06, p) * (1 - smoothstep(0.78, 1, p));
    const hole = smoothstep(0, 0.04, p) * (1 - smoothstep(0.86, 1, p));
    tones[g.home] = (tones[g.home] ?? 0) * (1 - 0.95 * hole);
    const x = g.x + g.drift * strength * progress;
    const y =
      g.y -
      g.lift * lift * Math.sin(Math.PI * p) +
      g.lift * 0.7 * p * p +
      sy * 0.9 * Math.sin(TAU * (p * 1.5 + g.sway));
    const xi = Math.floor(x / sx);
    const yi = Math.floor(y / sy);
    const index = yi * width + xi;
    // Off the grid, or back over the sand: landed, merged into the surface.
    const outside = xi < 0 || yi < 0 || xi >= width || yi >= height;
    if (outside || ((mask[index] ?? 0) >= 0.5 && p > 0.15)) {
      continue;
    }
    splat(index, alpha * grainTone);
    // At full speed a grain streaks: one fainter sample behind it.
    const speed = 0.5 - 0.5 * Math.cos(TAU * p);
    if (xi > 0 && speed > 0.6) {
      splat(index - 1, alpha * speed * 0.62 * grainTone);
    }
    if (colors && alpha > 0.5) {
      tintCell(dune, colors, xi, yi, accent);
    }
  }
};

/**
 * Fill the tone field for time `t`. Everything is a function of `t` on a
 * `LOOP`-second cycle, so the motion loops and a still frame needs no
 * history.
 */
const fillDune = (
  dune: Dune,
  field: ToneField,
  t: number,
  wind: number,
  { ink, accent }: Palette,
  grainTone: number
) => {
  const strength = Math.min(2, Math.max(0, wind));
  fillSand(dune, field, t, strength, ink);
  if (strength > 0) {
    flyGrains(dune, field, t, strength, accent, grainTone);
  }
};

/* -------------------------------------------------------------------------- */
/* Look                                                                        */
/* -------------------------------------------------------------------------- */

const toBytes = (rgba: readonly number[] | undefined, fallback: Rgb8): Rgb8 =>
  rgba
    ? [
        Math.round((rgba[0] ?? 0) * 255),
        Math.round((rgba[1] ?? 0) * 255),
        Math.round((rgba[2] ?? 0) * 255),
      ]
    : fallback;

const rampPaper = (ramp: AsciiLook["ramp"]): string => {
  if (typeof ramp === "string") {
    return (RAMPS[ramp as keyof typeof RAMPS] ?? RAMPS.mainframe)[0];
  }
  return ramp?.[0] ?? RAMPS.mainframe[0];
};

/* -------------------------------------------------------------------------- */
/* The terminal line                                                           */
/* -------------------------------------------------------------------------- */

const TYPE_MS = 42;
/** A pause between the command and its error, like a shell thinking. */
const ANSWER_MS = 260;
const BLINK_MS = 1060;

const subscribeToLocation = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};
const readPathname = () => window.location.pathname;
// The server has no location: render without a path, then fill it in
// after hydration so the markup matches.
const readServerPathname = () => null;

const displayPath = (path: string) => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

/** Characters typed so far: the whole line at once when motion is off. */
const useTyped = (text: string | null, motion: boolean) => {
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (text === null) {
      return;
    }
    if (!motion) {
      setTyped(text.length + 1);
      return;
    }
    setTyped(0);
    let count = 0;
    let timer = 0;
    const tick = () => {
      count += 1;
      setTyped(count);
      if (count <= text.length) {
        timer = window.setTimeout(
          tick,
          count === text.length ? ANSWER_MS : TYPE_MS
        );
      }
    };
    timer = window.setTimeout(tick, TYPE_MS * 4);
    return () => window.clearTimeout(timer);
  }, [text, motion]);
  return typed;
};

const Cursor = ({ blink, color }: { blink: boolean; color: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const inView = useInView(ref);
  const visible = useDocumentVisible();
  useEffect(() => {
    const el = ref.current;
    if (!(el && blink)) {
      return;
    }
    const animation = el.animate(
      [
        { easing: "step-end", opacity: 1 },
        { easing: "step-end", offset: 0.5, opacity: 0 },
        { opacity: 1 },
      ],
      { duration: BLINK_MS, iterations: Number.POSITIVE_INFINITY }
    );
    animationRef.current = animation;
    return () => {
      animation.cancel();
      animationRef.current = null;
    };
  }, [blink]);
  // Like the renderers, the blink rests offscreen and in hidden tabs.
  useEffect(() => {
    const animation = animationRef.current;
    if (!animation) {
      return;
    }
    if (inView && visible) {
      animation.play();
    } else {
      animation.pause();
    }
  }, [blink, inView, visible]);
  return (
    <span
      ref={ref}
      className="ml-px inline-block h-[1.1em] w-[0.55em] translate-y-[0.18em]"
      style={{ background: color }}
    />
  );
};

interface TerminalLineProps {
  readonly command: string;
  readonly message: string;
  readonly path: string | null;
  readonly accent: string;
  readonly motion: boolean;
  readonly compact: boolean;
}

const TerminalLine = ({
  command,
  message,
  path,
  accent,
  motion,
  compact,
}: TerminalLineProps) => {
  const shown = path === null ? null : displayPath(path);
  const line = shown === null ? null : `${command} ${shown}`;
  const typed = useTyped(line, motion);
  const done = line !== null && typed > line.length;
  const name = command.split(" ")[0] ?? command;
  const prompt = (
    <span className="select-none" style={{ color: accent }}>
      ${" "}
    </span>
  );
  return (
    <div
      className={cn(
        "border-border bg-foreground/[0.025] w-full rounded-lg border text-left font-[family-name:var(--ascii-font,ui-monospace,monospace)] [font-variant-ligatures:none]",
        compact
          ? "max-w-sm px-3 py-2 text-[11px] leading-5"
          : "max-w-md px-4 py-3 text-[13px] leading-6"
      )}
    >
      <div
        aria-hidden="true"
        className="whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        <div>
          {prompt}
          <span className="text-foreground">
            {line === null ? "" : line.slice(0, typed)}
          </span>
          {done ? null : <Cursor blink={false} color={accent} />}
        </div>
        {done ? (
          <>
            <div className="text-muted-foreground">
              {name}: {message}: {shown}
            </div>
            <div>
              {prompt}
              <Cursor blink={motion} color={accent} />
            </div>
          </>
        ) : null}
      </div>
      {shown === null ? null : (
        <p className="sr-only">
          {name}: {message}: {shown}
        </p>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* The page                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A not-found page. The code is drawn in glyphs as a bank of sand: gusts
 * sweep across it and wear its edges away, and grains lift off the crests,
 * drift downwind and settle again, so it erodes without ever going. Under
 * it a terminal line echoes the requested path, then a title, a short
 * description and your actions, all as real DOM text.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const NotFound = ({
  code = "404",
  title = "Page not found",
  description = "The page you asked for isn't here. It may have moved, or the link may be out of date.",
  path,
  command = "cd",
  message = "no such file or directory",
  actions,
  titleAs: Title = "h1",
  accent = "orange",
  wind = 1,
  compact = false,
  cell,
  speed = 1,
  animate = true,
  fps = 30,
  stillTime = 5.5,
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
  background = "transparent",
  fx,
  className,
  ...props
}: NotFoundProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const motion = animate && !reduced;
  const location = useSyncExternalStore(
    subscribeToLocation,
    readPathname,
    readServerPathname
  );
  const theme = useAsciiColors(rootRef, [
    "--ascii-ink",
    "--ascii-paper",
    accent,
  ]);
  const duneRef = useRef<Dune | null>(null);
  const fieldRef = useRef<ToneField | null>(null);

  const set = resolveCharset(charset, chars);
  const themeInk = toBytes(theme?.[0], [230, 230, 230]);
  const themePaper = toBytes(theme?.[1], [10, 10, 10]);
  const accentBytes = toBytes(theme?.[2], [252, 180, 66]);

  // Phosphor and duotone bring their own glass and ink.
  let ink: AsciiColor = "--ascii-ink";
  let paper: AsciiColor = "--ascii-paper";
  let palette: readonly Rgb8[] = [themePaper, accentBytes, themeInk];
  if (colorMode === "duotone") {
    paper = rampPaper(ramp);
  } else if (phosphor && colorMode === "mono") {
    ({ ink, paper } = PHOSPHORS[phosphor]);
    palette = [hexToRgb(PHOSPHORS[phosphor].paper), hexToRgb(ink)];
  }
  const options: MapOptions = {
    ansi,
    charset: set,
    colorMode,
    // Dots light or stay dark; an ordered blue-noise matrix turns the
    // thinning edges into a stipple of loose grains.
    dither:
      dither ??
      (set.kind === "ramp" || set.kind === "edge" ? "none" : "blue-noise"),
    edgeThreshold,
    grade,
    invert,
    palette,
    ramp,
    threshold,
  };

  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    time,
  }: AsciiGridDrawContext) => {
    // The digits take the page's own typeface, as a heading would.
    const root = rootRef.current;
    const font = root ? getComputedStyle(root).fontFamily : readFont();
    // Rebuild when the box, the glyphs or the typeface change; a web font
    // that finishes loading changes the digits' shape.
    const loaded = document.fonts?.check?.(`800 16px ${font}`) ?? true;
    const key = [
      code,
      font,
      loaded,
      columns,
      rows,
      set.id,
      metrics.width,
      metrics.height,
    ].join("|");
    let dune = duneRef.current;
    if (dune?.key !== key) {
      dune = buildDune(key, {
        cellHeight: metrics.height,
        cellWidth: metrics.width,
        code,
        columns,
        font,
        rows,
        set,
      });
      duneRef.current = dune;
    }
    if (!dune) {
      return;
    }
    let field = fieldRef.current;
    if (field?.width !== dune.width || field.height !== dune.height) {
      field = createToneField(columns, rows, set, { color: true });
      fieldRef.current = field;
    }
    // A dot is a grain; on a ramp, full tone is the densest glyph, so a
    // grain takes a light one (. or :) instead.
    const grainTone =
      set.kind === "braille" || set.kind === "quadrants" ? 1 : 0.32;
    fillDune(
      dune,
      field,
      time,
      wind,
      { accent: accentBytes, ink: themeInk },
      grainTone
    );
    mapTones(field, columns, rows, options, frame);
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex w-full flex-col items-center text-center",
        compact ? "gap-4 px-4 py-6" : "gap-7 px-6 py-12",
        className
      )}
      {...props}
    >
      <div
        role="img"
        aria-label={code}
        className={cn(
          "relative w-full",
          compact ? "h-24 max-w-sm" : "h-[clamp(9rem,26vw,17rem)] max-w-3xl"
        )}
      >
        <AsciiGrid
          draw={draw}
          cell={cell ?? (compact ? 8 : 10)}
          ink={ink}
          paper={background === "paper" ? paper : "transparent"}
          colored={colorMode !== "mono"}
          speed={speed}
          animate={animate}
          fps={fps}
          stillTime={stillTime}
          handle={handle}
          fx={fx}
          className="absolute inset-0"
        />
      </div>
      <TerminalLine
        command={command}
        message={message}
        path={path ?? location}
        accent={cssColor(accent)}
        motion={motion}
        compact={compact}
      />
      <div
        className={cn(
          "flex flex-col items-center",
          compact ? "max-w-xs gap-1" : "max-w-md gap-2"
        )}
      >
        <Title
          className={cn(
            "text-foreground font-semibold tracking-tight text-balance",
            compact ? "text-base" : "text-2xl sm:text-3xl"
          )}
        >
          {title}
        </Title>
        {description ? (
          <p
            className={cn(
              "text-muted-foreground text-pretty",
              compact ? "text-xs" : "text-sm sm:text-base"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
};
