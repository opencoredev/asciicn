"use client";

import { useRef } from "react";

import {
  ANSI16,
  AsciiGrid,
  BOX,
  createToneField,
  eighthsBar,
  EIGHTHS_UP,
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
  BoxStyle,
  MutableFrame,
  PostFx,
  Rgb8,
  ToneField,
} from "@/lib/ascii";

/** One command in the console session: what is typed, then what it prints. */
export interface DeckCommand {
  readonly command: string;
  readonly output: readonly string[];
}

export interface TerminalDeckSceneProps extends AsciiSceneProps {
  /** Host name in the prompt and the header bar. Default `"asciicn"`. */
  hostname?: string;
  /** The session the console types, looping. Default: a satellite uplink session. */
  script?: readonly DeckCommand[];
  /** Box-drawing style of the pane frames. Default `"rounded"`. */
  frame?: BoxStyle;
}

const DEFAULT_SCRIPT: readonly DeckCommand[] = [
  {
    command: "uplink --sat 7 --lock",
    output: [
      "acquiring carrier on 8.412 GHz ...",
      "doppler -2.31 kHz  snr 18.4 dB",
      "LOCK  sat-07 / az 213.4 el 41.2",
    ],
  },
  {
    command: "ping -c 3 relay-3",
    output: [
      "64 B from relay-3: seq=1 t=41.7 ms",
      "64 B from relay-3: seq=2 t=39.9 ms",
      "64 B from relay-3: seq=3 t=40.4 ms",
    ],
  },
  {
    command: "glyphs --scan braille",
    output: ["256 masks  2x4 dots  ok", "atlas 2.1 MB  cached"],
  },
  {
    command: "tail -n 3 /var/log/telemetry",
    output: [
      "[21:47:03] bus 28.1 V  load 0.82",
      "[21:47:04] panel A 412 W  B 409 W",
      "[21:47:05] attitude nominal",
    ],
  },
  {
    command: "status --all",
    output: ["7 services up  0 degraded", "next pass in 00:41:12"],
  },
];

// The deck's own colours, chosen for a dark glass backdrop.
const DECK = {
  amber: hexToRgb("#ffb347"),
  ascii: hexToRgb("#8ab8ff"),
  backdrop: "#03080a",
  body: hexToRgb("#ffcf6e"),
  changed: hexToRgb("#ffe08a"),
  dim: hexToRgb("#4f8f86"),
  dish: hexToRgb("#e9f5ff"),
  earth: hexToRgb("#2b6cff"),
  frame: hexToRgb("#2a8a7f"),
  hot: hexToRgb("#ff5f6d"),
  offset: hexToRgb("#3f7f78"),
  panel: hexToRgb("#4cc9ff"),
  path: hexToRgb("#6fa8ff"),
  star: hexToRgb("#a9c6ff"),
  text: hexToRgb("#b9f5e4"),
  title: hexToRgb("#7dfcd8"),
  trace: hexToRgb("#5dffb0"),
  traceHead: hexToRgb("#effff8"),
  user: hexToRgb("#5dffb0"),
} as const;

const DEFAULT_FX: PostFx = { bloom: 0.5, scanlines: 0.45, vignette: 0.4 };

// --- Colour: scene colours through the active colour mode -----------------

interface DeckInk {
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
): DeckInk => {
  const { colorMode = "truecolor", grade } = look;
  if (colorMode === "duotone") {
    const ramp = look.ramp ?? "mainframe";
    const stops = (typeof ramp === "string" ? RAMPS[ramp] : ramp).map(hexToRgb);
    return {
      tint: (rgb, level = 1) =>
        sampleRamp(stops, 0.3 + 0.7 * brightness(rgb) * level),
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
        mix(paper, ink, 0.28 + 0.72 * brightness(rgb) * level),
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
    ? [(rgba[0] ?? 0) * 255, (rgba[1] ?? 0) * 255, (rgba[2] ?? 0) * 255]
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
): DeckInk => {
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

// --- Tone field with per-sample colour --------------------------------------

interface Canvas {
  readonly field: ToneField;
  /** RGB bytes per sample, beside the field's tones. */
  readonly rgb: Uint8ClampedArray;
  readonly gx: number;
  readonly gy: number;
  readonly key: string;
}

const createCanvas = (
  columns: number,
  rows: number,
  gx: number,
  gy: number
): Canvas => {
  const field = createToneField(columns, rows, {
    glyphs: [" ", "#"],
    grid: [gx, gy],
    id: "deck",
    kind: "ramp",
    label: "deck",
  });
  return {
    field,
    gx,
    gy,
    key: `${columns}x${rows}x${gx}x${gy}`,
    rgb: new Uint8ClampedArray(field.width * field.height * 3),
  };
};

/** Light a sample, keeping the brighter of what is there and the new tone. */
const plot = (
  canvas: Canvas,
  x: number,
  y: number,
  tone: number,
  rgb: Rgb8
) => {
  const { field } = canvas;
  const sx = Math.floor(x);
  const sy = Math.floor(y);
  if (sx < 0 || sy < 0 || sx >= field.width || sy >= field.height) {
    return;
  }
  const index = sy * field.width + sx;
  if (tone <= (field.tones[index] ?? 0)) {
    return;
  }
  const [r, g, b] = rgb;
  field.tones[index] = tone;
  canvas.rgb[index * 3] = r;
  canvas.rgb[index * 3 + 1] = g;
  canvas.rgb[index * 3 + 2] = b;
};

const line = (
  canvas: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tone: number,
  rgb: Rgb8
) => {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    plot(canvas, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, tone, rgb);
  }
};

/**
 * Colour every inked cell from its samples, weighted by tone, so a thin
 * Braille line keeps its full colour instead of averaging with the dark
 * samples around it.
 */
const colorCells = (
  canvas: Canvas,
  frame: MutableFrame,
  ink: DeckInk,
  fallback: Rgb8
) => {
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
          const tone = field.tones[base + dx] ?? 0;
          if (tone > 0) {
            r += (rgb[(base + dx) * 3] ?? 0) * tone;
            g += (rgb[(base + dx) * 3 + 1] ?? 0) * tone;
            b += (rgb[(base + dx) * 3 + 2] ?? 0) * tone;
            weight += tone;
            peak = Math.max(peak, tone);
          }
        }
      }
      const source: Rgb8 =
        weight > 0 ? [r / weight, g / weight, b / weight] : fallback;
      const [cr, cg, cb] = ink.tint(
        source,
        weight > 0 ? 0.35 + 0.65 * peak : 0.5
      );
      colors[cell * 4] = cr;
      colors[cell * 4 + 1] = cg;
      colors[cell * 4 + 2] = cb;
      colors[cell * 4 + 3] = 255;
    }
  }
};

// --- Small maths ------------------------------------------------------------

/** A stable pseudo-random number in [0, 1) for up to three numbers. */
const random = (a: number, b = 0, c = 0): number => {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43_758.545;
  return x - Math.floor(x);
};

/** A stable pseudo-random integer in [0, 2^32). */
const hash = (a: number, b = 0, c = 0): number =>
  Math.floor(random(a, b, c) * 4_294_967_296);

const smooth = (t: number, seed: number) => {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return random(i, seed) * (1 - u) + random(i + 1, seed) * u;
};

const pad = (value: number) => String(value).padStart(2, "0");

const clock = (seconds: number) => {
  const total = Math.floor(seconds);
  return `${pad(Math.floor(total / 3600) % 24)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
};

// --- Layout -------------------------------------------------------------------

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface DeckLayout {
  readonly sat: Rect;
  readonly scope: Rect | null;
  readonly hex: Rect | null;
  readonly diag: Rect | null;
  readonly tty: Rect;
}

const layoutDeck = (columns: number, rows: number): DeckLayout => {
  const top = 1;
  const body = rows - top;
  if (columns >= 90) {
    const ttyHeight = Math.min(9, Math.max(4, Math.round(body * 0.24)));
    const upper = body - ttyHeight;
    const left = Math.round(columns * 0.56);
    const satHeight = Math.round(upper * 0.6);
    const hexHeight = Math.round(upper * 0.52);
    return {
      diag: {
        h: upper - hexHeight,
        w: columns - left,
        x: left,
        y: top + hexHeight,
      },
      hex: { h: hexHeight, w: columns - left, x: left, y: top },
      sat: { h: satHeight, w: left, x: 0, y: top },
      scope: { h: upper - satHeight, w: left, x: 0, y: top + satHeight },
      tty: { h: ttyHeight, w: columns, x: 0, y: top + upper },
    };
  }
  // Narrow: one column of panes, dropping the least important when short.
  const ttyHeight = Math.min(8, Math.max(4, Math.round(body * 0.2)));
  const rest = body - ttyHeight;
  let weights = { diag: 0, hex: 0, sat: 1, scope: 0 };
  if (rest >= 44) {
    weights = { diag: 0.24, hex: 0.22, sat: 0.36, scope: 0.18 };
  } else if (rest >= 26) {
    weights = { diag: 0.3, hex: 0, sat: 0.45, scope: 0.25 };
  } else if (rest >= 14) {
    weights = { diag: 0, hex: 0, sat: 0.6, scope: 0.4 };
  }
  let y = top;
  const take = (share: number): Rect | null => {
    if (share === 0) {
      return null;
    }
    const h = Math.round(rest * share);
    const rect = { h, w: columns, x: 0, y };
    y += h;
    return rect;
  };
  const sat = take(weights.sat) ?? { h: rest, w: columns, x: 0, y: top };
  const hex = take(weights.hex);
  const scope = take(weights.scope);
  const diagHeight = top + rest - y;
  const diag = weights.diag > 0 ? { h: diagHeight, w: columns, x: 0, y } : null;
  return {
    diag,
    hex,
    sat,
    scope,
    tty: { h: ttyHeight, w: columns, x: 0, y: top + rest },
  };
};

const drawBox = (
  frame: MutableFrame,
  rect: Rect,
  style: BoxStyle,
  title: string,
  status: string,
  colors: { frame: Rgb8; title: Rgb8; status: Rgb8 }
) => {
  const box = BOX[style];
  const { x, y, w, h } = rect;
  if (w < 4 || h < 2) {
    return;
  }
  frame.fillRect(x + 1, y, w - 2, 1, box.h, colors.frame);
  frame.fillRect(x + 1, y + h - 1, w - 2, 1, box.h, colors.frame);
  frame.fillRect(x, y + 1, 1, h - 2, box.v, colors.frame);
  frame.fillRect(x + w - 1, y + 1, 1, h - 2, box.v, colors.frame);
  frame.put(x, y, box.tl, colors.frame);
  frame.put(x + w - 1, y, box.tr, colors.frame);
  frame.put(x, y + h - 1, box.bl, colors.frame);
  frame.put(x + w - 1, y + h - 1, box.br, colors.frame);
  if (w > title.length + 6) {
    frame.write(x + 2, y, ` ${title} `, colors.title);
  }
  if (status && w > title.length + status.length + 10) {
    frame.write(x + w - status.length - 4, y, ` ${status} `, colors.status);
  }
};

const inner = (rect: Rect): Rect => ({
  h: rect.h - 2,
  w: rect.w - 2,
  x: rect.x + 1,
  y: rect.y + 1,
});

// --- Satellite ----------------------------------------------------------------

type Part = "body" | "panel" | "dish";
type Segment = readonly [number, number, number, number, number, number, Part];

const buildSatellite = (): readonly Segment[] => {
  const segments: Segment[] = [];
  const push = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    part: Part
  ) => segments.push([a[0], a[1], a[2], b[0], b[1], b[2], part]);

  // Body: a box with a belt.
  const bx = 0.26;
  const by = 0.36;
  const bz = 0.26;
  const corners = [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sy) =>
      [-1, 1].map((sz) => [sx * bx, sy * by, sz * bz] as const)
    )
  );
  for (let a = 0; a < corners.length; a += 1) {
    for (let b = a + 1; b < corners.length; b += 1) {
      const ca = corners[a];
      const cb = corners[b];
      if (!(ca && cb)) {
        continue;
      }
      const shared =
        Number(ca[0] === cb[0]) +
        Number(ca[1] === cb[1]) +
        Number(ca[2] === cb[2]);
      if (shared === 2) {
        push(ca, cb, "body");
      }
    }
  }
  for (const sx of [-1, 1]) {
    push([sx * bx, 0, -bz], [sx * bx, 0, bz], "body");
  }
  for (const sz of [-1, 1]) {
    push([-bx, 0, sz * bz], [bx, 0, sz * bz], "body");
  }

  // Solar wings: a boom, then a panel ruled into cells.
  for (const side of [-1, 1]) {
    push([side * bx, 0, 0], [side * 0.48, 0, 0], "body");
    const x0 = side * 0.48;
    const x1 = side * 1.78;
    const z = 0.32;
    for (let i = 0; i <= 5; i += 1) {
      const x = x0 + ((x1 - x0) * i) / 5;
      push([x, 0, -z], [x, 0, z], "panel");
    }
    for (let j = 0; j <= 2; j += 1) {
      const zz = -z + (2 * z * j) / 2;
      push([x0, 0, zz], [x1, 0, zz], "panel");
    }
  }

  // Dish on top with spokes and a feed.
  const rim = 0.36;
  const rimY = 0.66;
  const steps = 18;
  for (let i = 0; i < steps; i += 1) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 1) / steps) * Math.PI * 2;
    push(
      [Math.cos(a0) * rim, rimY, Math.sin(a0) * rim],
      [Math.cos(a1) * rim, rimY, Math.sin(a1) * rim],
      "dish"
    );
    if (i % 3 === 0) {
      push(
        [Math.cos(a0) * rim, rimY, Math.sin(a0) * rim],
        [0, by + 0.06, 0],
        "dish"
      );
    }
  }
  push([0, by, 0], [0, 0.98, 0], "dish");
  // Whip antenna below.
  push([0.1, -by, 0.1], [0.18, -0.86, 0.14], "body");
  return segments;
};

const SATELLITE = buildSatellite();

const PART_COLORS: Record<Part, Rgb8> = {
  body: DECK.body,
  dish: DECK.dish,
  panel: DECK.panel,
};

interface Pose {
  yaw: number;
  pitch: number;
}

const drawSatellite = (
  canvas: Canvas,
  rect: Rect,
  pose: Pose,
  time: number,
  pixelAspect: number
) => {
  const { gx, gy } = canvas;
  const x0 = rect.x * gx;
  const y0 = rect.y * gy;
  const w = rect.w * gx;
  const h = rect.h * gy;
  if (w <= 0 || h <= 0) {
    return;
  }

  // Stars, then the limb of the planet below.
  for (let i = 0; i < Math.round((w * h) / 140); i += 1) {
    const sx = x0 + random(i, 11) * w;
    const sy = y0 + random(i, 12) * h;
    const twinkle = 0.5 + 0.5 * Math.sin(time * (1 + random(i, 13) * 3) + i);
    plot(canvas, sx, sy, 0.2 + 0.45 * twinkle * random(i, 14), DECK.star);
  }
  const widthUnits = w * pixelAspect;
  const radius = Math.max(widthUnits, h) * 1.4;
  const cx = x0 + w * 0.5;
  const cy = y0 + h + radius - h * 0.16;
  const arcSteps = Math.round(widthUnits * 1.6);
  for (let i = 0; i <= arcSteps; i += 1) {
    const a = -Math.PI / 2 + (i / arcSteps - 0.5) * 1.4;
    const px = cx + (Math.cos(a) * radius) / pixelAspect;
    const py = cy + Math.sin(a) * radius;
    if (px >= x0 && px < x0 + w && py >= y0 && py < y0 + h) {
      plot(canvas, px, py, 0.5, DECK.earth);
      plot(canvas, px, py + 2, 0.22, DECK.earth);
    }
  }

  // The satellite, in perspective, brighter when nearer.
  const unit = Math.min(widthUnits * 0.6, h) * 0.4;
  const cosY = Math.cos(pose.yaw);
  const sinY = Math.sin(pose.yaw);
  const cosP = Math.cos(pose.pitch);
  const sinP = Math.sin(pose.pitch);
  const camera = 4.2;
  const project = (x: number, y: number, z: number) => {
    const rx = x * cosY + z * sinY;
    const rz = -x * sinY + z * cosY;
    const ry = y * cosP - rz * sinP;
    const depth = camera + y * sinP + rz * cosP;
    const f = camera / depth;
    return [
      cx + (rx * f * unit) / pixelAspect,
      y0 + h * 0.46 - ry * f * unit,
      depth,
    ] as const;
  };
  const bob = Math.sin(time * 0.7) * 0.04;
  for (const [ax, ay, az, bx, by, bz, part] of SATELLITE) {
    const [px0, py0, d0] = project(ax, ay + bob, az);
    const [px1, py1, d1] = project(bx, by + bob, bz);
    const near = 1 - ((d0 + d1) / 2 - (camera - 1.8)) / 3.6;
    const tone = 0.42 + 0.58 * Math.min(1, Math.max(0, near));
    line(canvas, px0, py0, px1, py1, tone, PART_COLORS[part]);
  }
};

// --- Oscilloscope -----------------------------------------------------------

const signal = (u: number, t: number) =>
  0.55 * Math.sin(Math.PI * 2 * (3 * u + 0.8 * t)) +
  0.22 * Math.sin(Math.PI * 2 * (7.3 * u - 1.7 * t)) +
  0.28 * (smooth(u * 40 + t * 9, 5) - 0.5);

const drawScope = (canvas: Canvas, rect: Rect, time: number) => {
  const { gx, gy } = canvas;
  const x0 = rect.x * gx;
  const y0 = rect.y * gy;
  const w = rect.w * gx;
  const h = rect.h * gy;
  if (w < 4 || h < 4) {
    return;
  }
  const mid = y0 + h / 2;
  // Graticule: dotted divisions.
  for (let d = 1; d < 8; d += 1) {
    const gxLine = x0 + Math.round((w * d) / 8);
    for (let y = y0; y < y0 + h; y += 3) {
      plot(canvas, gxLine, y, 0.16, DECK.dim);
    }
  }
  for (const share of [0.25, 0.5, 0.75]) {
    const gyLine = Math.round(y0 + h * share);
    for (let x = x0; x < x0 + w; x += 2) {
      plot(canvas, x, gyLine, share === 0.5 ? 0.24 : 0.14, DECK.dim);
    }
  }
  // The trace, drawn by a sweep that leaves a fading phosphor trail.
  const rate = 0.42;
  const head = (time * rate) % 1;
  const amp = h * 0.38;
  let previous = Number.NaN;
  for (let x = 0; x < w; x += 1) {
    const u = x / w;
    const age = (head - u + 1) % 1;
    const glow = Math.exp(-age * 3.4);
    if (glow < 0.06) {
      previous = Number.NaN;
      continue;
    }
    const drawnAt = time - age / rate;
    const y = mid - signal(u, drawnAt) * amp;
    const from = Number.isNaN(previous) ? y : previous;
    const top = Math.min(from, y);
    const bottom = Math.max(from, y);
    const color = age < 0.02 ? DECK.traceHead : DECK.trace;
    for (let yy = top; yy <= bottom + 0.001; yy += 1) {
      plot(canvas, x0 + x, yy, 0.25 + 0.75 * glow, color);
    }
    previous = y;
  }
};

// --- Text panes ---------------------------------------------------------------

// 0x7F3A00, where the dump starts.
const BASE_ADDRESS = 8_337_920;

const PLANTED = ["ASCIICN", "SAT-07", "GLYPH", "UPLINK", "0xDECK", "BRAILLE"];

const byteAt = (lineIndex: number, column: number, epoch: number) => {
  const word = PLANTED[hash(lineIndex, 3) % PLANTED.length] ?? "";
  const start = hash(lineIndex, 4) % 12;
  if (
    hash(lineIndex, 5) % 3 === 0 &&
    column >= start &&
    column < start + word.length
  ) {
    return { changed: false, value: word.codePointAt(column - start) ?? 46 };
  }
  const live = random(lineIndex, column, epoch) < 0.05;
  const value = live
    ? hash(lineIndex, column, epoch) % 256
    : hash(lineIndex, column) % 256;
  return { changed: live, value };
};

const drawHex = (
  frame: MutableFrame,
  rect: Rect,
  time: number,
  ink: DeckInk,
  hoverRow: number
) => {
  const fixed = 6 + 2 + 2;
  const perByte = 4;
  const bytes = [16, 8, 4].find((n) => fixed + n * perByte - 1 <= rect.w) ?? 0;
  if (bytes === 0) {
    return;
  }
  const first = Math.floor(time * 2.4);
  const epoch = Math.floor(time * 5);
  const offsetColor = ink.tint(DECK.offset);
  const byteColor = ink.tint(DECK.text, 0.82);
  const changedColor = ink.tint(DECK.changed);
  const asciiColor = ink.tint(DECK.ascii, 0.85);
  const cursorColor = ink.tint(DECK.amber);
  const cursorRow = Math.floor(smooth(time * 0.35, 9) * rect.h);
  for (let row = 0; row < rect.h; row += 1) {
    const lineIndex = first + row;
    const y = rect.y + row;
    const lit = row === hoverRow || row === cursorRow;
    const address = (BASE_ADDRESS + lineIndex * bytes)
      .toString(16)
      .toUpperCase();
    frame.write(
      rect.x,
      y,
      address.padStart(6, "0").slice(-6),
      lit ? cursorColor : offsetColor
    );
    for (let i = 0; i < bytes; i += 1) {
      const { value, changed } = byteAt(lineIndex, i, epoch);
      let color = lit ? cursorColor : byteColor;
      if (changed) {
        color = changedColor;
      }
      const hx = rect.x + 8 + i * 3;
      frame.write(
        hx,
        y,
        value.toString(16).toUpperCase().padStart(2, "0"),
        color
      );
      const printable = value >= 33 && value < 127;
      frame.put(
        rect.x + 8 + bytes * 3 + 1 + i,
        y,
        printable ? String.fromCodePoint(value) : "·",
        changed ? changedColor : asciiColor
      );
    }
    if (lit && row === hoverRow) {
      frame.put(rect.x + 6, y, "◂", cursorColor);
    }
  }
};

const BAR_WIDTH_MAX = 34;

const loadAt = (t: number) => 0.12 + 0.86 * smooth(t * 0.6, 50) ** 1.3;

const drawDiag = (
  frame: MutableFrame,
  rect: Rect,
  time: number,
  ink: DeckInk
) => {
  const label = ink.tint(DECK.dim);
  const value = ink.tint(DECK.text);
  const track = ink.tint(DECK.frame);
  // Bars shade from green through amber to red along their length.
  const barWidth = Math.max(6, Math.min(BAR_WIDTH_MAX, rect.w - 13));
  const shades = Array.from({ length: barWidth }, (_, i) => {
    const at = i / Math.max(1, barWidth - 1);
    if (at > 0.8) {
      return ink.tint(DECK.hot);
    }
    return ink.tint(at > 0.6 ? DECK.amber : DECK.trace);
  });
  const meter =
    (name: string, level: number, suffix: string) => (y: number) => {
      frame.write(rect.x, y, name.padEnd(5), label);
      const bar = eighthsBar(level, barWidth);
      let i = 0;
      for (const glyph of bar) {
        const empty = glyph === " ";
        frame.put(
          rect.x + 5 + i,
          y,
          empty ? "·" : glyph,
          empty ? track : shades[i]
        );
        i += 1;
      }
      frame.write(rect.x + 6 + barWidth, y, suffix, value);
    };
  const rows: ((y: number) => void)[] = [];
  const cores = rect.h >= 11 ? 4 : 2;
  for (let core = 0; core < cores; core += 1) {
    const level = Math.min(
      1,
      0.12 + 0.88 * smooth(time * 0.9 + core * 7, core + 20) ** 1.3
    );
    rows.push(
      meter(`CPU${core}`, level, `${Math.round(level * 100)}%`.padStart(4))
    );
  }
  const memory = 0.58 + 0.12 * smooth(time * 0.15, 31);
  rows.push(meter("MEM", memory, `${(memory * 8).toFixed(1)}G`));
  const uptime = 1_051_200 + time;
  const packets = Math.floor(1_204_331 + time * 2417);
  const rx = 1.284 + time * 0.0124;
  const text = (content: string) => (y: number) => {
    const [name = "", ...rest] = content.split(" ");
    frame.write(rect.x, y, name.padEnd(5), label);
    frame.write(rect.x + 5, y, rest.join(" ").slice(0, rect.w - 5), value);
  };
  rows.push(
    text(
      `TEMP ${Math.round(58 + 6 * smooth(time * 0.2, 40))}°C  FAN ${Math.round(2100 + 300 * smooth(time * 0.3, 41))} rpm`
    )
  );
  rows.push(
    text(
      `RX ${rx.toFixed(3)} GB  ▲ ${(12 + 4 * smooth(time, 42)).toFixed(1)} MB/s`
    )
  );
  rows.push(text(`PKT ${packets.toLocaleString("en-US")}  ERR 0`));
  rows.push(text(`UP ${Math.floor(uptime / 86_400)}d ${clock(uptime)}`));
  const shown = Math.min(rows.length, rect.h);
  for (let i = 0; i < shown; i += 1) {
    rows[i]?.(rect.y + i);
  }

  // Load history in the rows left over, sampled backward in time so it
  // scrolls by itself. Taller panes get a taller chart.
  const height = Math.min(6, rect.h - shown - 1);
  if (height < 1) {
    return;
  }
  const width = Math.max(4, rect.w - 6);
  const top = rect.y + rect.h - height;
  frame.write(rect.x, top, "LOAD", label);
  frame.write(rect.x, top + 1, loadAt(time).toFixed(2), value);
  const color = ink.tint(DECK.title, 0.9);
  for (let i = 0; i < width; i += 1) {
    const load = loadAt(time - (width - 1 - i) * 0.5) * height;
    for (let level = 0; level < height; level += 1) {
      const fill = Math.min(1, Math.max(0, load - level));
      const glyph = EIGHTHS_UP[Math.round(fill * 8)] ?? " ";
      frame.put(rect.x + 6 + i, top + height - 1 - level, glyph, color);
    }
  }
};

interface TtyLine {
  readonly kind: "prompt" | "output";
  readonly text: string;
}

const TYPE_RATE = 22;
const LINE_DELAY = 0.14;
const PAUSE = 1.3;

const entryDuration = (entry: DeckCommand) =>
  entry.command.length / TYPE_RATE +
  0.35 +
  entry.output.length * LINE_DELAY +
  PAUSE;

const drawTty = (
  frame: MutableFrame,
  rect: Rect,
  time: number,
  ink: DeckInk,
  host: string,
  script: readonly DeckCommand[]
) => {
  if (script.length === 0 || rect.h <= 0) {
    return;
  }
  const lines: TtyLine[] = [];
  // The previous loop fills the history so the log is never empty.
  for (const entry of script) {
    lines.push({ kind: "prompt", text: entry.command });
    for (const out of entry.output) {
      lines.push({ kind: "output", text: out });
    }
  }
  const cycle = script.reduce((sum, entry) => sum + entryDuration(entry), 0);
  let left = ((time % cycle) + cycle) % cycle;
  let typing = "";
  for (const entry of script) {
    const duration = entryDuration(entry);
    if (left >= duration) {
      lines.push({ kind: "prompt", text: entry.command });
      for (const out of entry.output) {
        lines.push({ kind: "output", text: out });
      }
      left -= duration;
      continue;
    }
    const typed = Math.floor(left * TYPE_RATE);
    if (typed < entry.command.length) {
      typing = entry.command.slice(0, typed);
    } else {
      lines.push({ kind: "prompt", text: entry.command });
      const shown = Math.floor(
        (left - entry.command.length / TYPE_RATE - 0.35) / LINE_DELAY
      );
      for (const out of entry.output.slice(0, Math.max(0, shown))) {
        lines.push({ kind: "output", text: out });
      }
    }
    break;
  }
  const user = `deck@${host}`;
  const promptWidth = user.length + 4;
  const writePrompt = (y: number, command: string) => {
    frame.write(rect.x, y, user, ink.tint(DECK.user));
    frame.write(rect.x + user.length, y, ":", ink.tint(DECK.dim));
    frame.write(rect.x + user.length + 1, y, "~", ink.tint(DECK.path));
    frame.write(rect.x + user.length + 2, y, "$", ink.tint(DECK.dim));
    frame.write(
      rect.x + promptWidth,
      y,
      command.slice(0, rect.w - promptWidth),
      ink.tint(DECK.text)
    );
  };
  const visible = lines.slice(-(rect.h - 1));
  for (const [index, entry] of visible.entries()) {
    const y = rect.y + index;
    if (entry.kind === "prompt") {
      writePrompt(y, entry.text);
    } else {
      frame.write(
        rect.x + 2,
        y,
        entry.text.slice(0, rect.w - 2),
        ink.tint(DECK.dim, 1.4)
      );
    }
  }
  const y = rect.y + visible.length;
  writePrompt(y, typing);
  if (Math.floor(time * 1.9) % 2 === 0) {
    frame.put(
      rect.x + promptWidth + typing.length,
      y,
      "█",
      ink.tint(DECK.title)
    );
  }
};

interface PoseState {
  dragPitch: number;
  dragYaw: number;
  lastX: number;
  lastY: number;
  tiltX: number;
  tiltY: number;
  wasDown: boolean;
}

const contains = (rect: Rect, x: number, y: number) =>
  x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;

/** Drag spins the satellite; hovering its pane tilts it toward you. */
const updatePose = (
  pose: PoseState,
  pointer: AsciiGridDrawContext["pointer"],
  pane: Rect,
  delta: number,
  interactive: boolean
) => {
  const down = interactive && pointer.down;
  if (down && pose.wasDown) {
    pose.dragYaw += (pointer.x - pose.lastX) * 0.06;
    pose.dragPitch += (pointer.y - pose.lastY) * 0.08;
  }
  pose.wasDown = down;
  pose.lastX = pointer.x;
  pose.lastY = pointer.y;
  const over =
    interactive && pointer.inside && contains(pane, pointer.x, pointer.y);
  const ease = delta > 0 ? 1 - Math.exp(-delta * 4) : 1;
  const targetX = over ? (pointer.x - pane.x) / pane.w - 0.5 : 0;
  const targetY = over ? (pointer.y - pane.y) / pane.h - 0.5 : 0;
  pose.tiltX += (targetX - pose.tiltX) * ease;
  pose.tiltY += (targetY - pose.tiltY) * ease;
  if (!down && delta > 0) {
    pose.dragPitch *= Math.exp(-delta * 0.8);
  }
};

interface ChromeOptions {
  readonly boxStyle: BoxStyle;
  readonly hostname: string;
  readonly script: readonly DeckCommand[];
  readonly ink: DeckInk;
  readonly time: number;
  /** The pointer in cells while it is over the deck. */
  readonly hover: { x: number; y: number } | null;
}

/** Frames, text panes, the satellite read-outs and the header bar. */
const drawChrome = (
  frame: MutableFrame,
  layout: DeckLayout,
  { boxStyle, hostname, script, ink, time, hover }: ChromeOptions
) => {
  // Text panes draw over whatever the tone mapping left there.
  for (const pane of [layout.hex, layout.diag, layout.tty]) {
    if (pane) {
      frame.fillRect(pane.x, pane.y, pane.w, pane.h, " ");
    }
  }
  frame.fillRect(0, 0, frame.columns, 1, " ");

  const colors = {
    frame: ink.tint(DECK.frame),
    status: ink.tint(DECK.amber),
    title: ink.tint(DECK.title),
  };
  const lock = Math.floor(time * 1.2) % 2 === 0 ? "●" : "○";
  drawBox(frame, layout.sat, boxStyle, "SAT-LINK", `${lock} LOCK`, colors);
  if (layout.scope) {
    drawBox(frame, layout.scope, boxStyle, "SCOPE CH1", "2V/div", colors);
  }
  if (layout.hex) {
    drawBox(frame, layout.hex, boxStyle, "MEMDUMP", "0x7F3A00", colors);
    const pane = inner(layout.hex);
    const hoverRow =
      hover && contains(pane, hover.x, hover.y)
        ? Math.floor(hover.y) - pane.y
        : -1;
    drawHex(frame, pane, time, ink, hoverRow);
  }
  if (layout.diag) {
    drawBox(frame, layout.diag, boxStyle, "DIAG", "", colors);
    drawDiag(frame, inner(layout.diag), time, ink);
  }
  drawBox(frame, layout.tty, boxStyle, "TTY0", "", colors);
  drawTty(frame, inner(layout.tty), time, ink, hostname, script);

  // Read-outs inside the satellite pane.
  const sat = inner(layout.sat);
  if (sat.w > 30 && sat.h > 4) {
    const az = ((((time * 0.32 * 180) / Math.PI) % 360) + 360) % 360;
    const elevation = 41.2 + Math.sin(time * 0.23) * 6;
    const hud = `AZ ${az.toFixed(1).padStart(5)}°  EL ${elevation.toFixed(1)}°`;
    frame.write(sat.x + 1, sat.y + sat.h - 1, hud, ink.tint(DECK.title, 0.9));
    const strength = `SIG ${(-71 - 4 * smooth(time, 60)).toFixed(1)} dBm`;
    frame.write(
      sat.x + sat.w - strength.length - 1,
      sat.y,
      strength,
      ink.tint(DECK.amber)
    );
  }

  // Header bar.
  const width = layout.tty.w;
  const header = ` ◆ DECK/OS 2.6  ${hostname}`;
  const link = (96 + 3 * smooth(time * 0.5, 70)).toFixed(0);
  const right = `link ▲ ${link}%  ${clock(78_420 + time)} `;
  frame.write(0, 0, header.slice(0, width), ink.tint(DECK.title));
  if (width > header.length + right.length + 2) {
    frame.write(width - right.length, 0, right, ink.tint(DECK.dim, 1.5));
    frame.fillRect(
      header.length + 1,
      0,
      width - right.length - header.length - 2,
      1,
      "─",
      ink.tint(DECK.frame)
    );
  }
};

/**
 * Retro CRT Cyberdeck OS. A live multi-pane terminal console: a rotating
 * wireframe satellite, a scrolling hex dump, a waveform scope and system
 * diagnostics, framed in box-drawing panes that rearrange for narrow
 * screens. The charset draws the satellite and the scope; text panes stay
 * text. Drag the satellite to spin it; hover the hex dump to read a row.
 */
export const TerminalDeckScene = ({
  charset = "braille",
  chars,
  colorMode = "truecolor",
  phosphor,
  ramp,
  ansi,
  grade,
  invert,
  threshold = 0.15,
  edgeThreshold,
  dither,
  background = "paper",
  fx = DEFAULT_FX,
  cell = 14,
  speed = 1,
  animate = true,
  fps = 30,
  stillTime = 6,
  interactive = true,
  handle,
  hostname = "asciicn",
  script = DEFAULT_SCRIPT,
  frame: boxStyle = "rounded",
  className,
  ...props
}: TerminalDeckSceneProps) => {
  const canvasRef = useRef<Canvas | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
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
    DECK.backdrop
  );
  const ink = sceneInk({ ansi, colorMode, grade, phosphor, ramp }, tokens, {
    ink: DECK.text,
    paper: hexToRgb(DECK.backdrop),
  });

  const draw = ({
    frame,
    columns,
    rows,
    time,
    delta,
    pointer,
    metrics,
  }: AsciiGridDrawContext) => {
    const set = resolveCharset(charset, chars);
    const [gx, gy] = set.grid;
    const key = `${columns}x${rows}x${gx}x${gy}`;
    if (canvasRef.current?.key !== key) {
      canvasRef.current = createCanvas(columns, rows, gx, gy);
    }
    const canvas = canvasRef.current;
    canvas.field.tones.fill(0);
    canvas.rgb.fill(0);

    // The grid rounds up to cover the box; frames use only whole cells.
    const box = rootRef.current;
    const layout = layoutDeck(
      box
        ? Math.min(columns, Math.floor(box.clientWidth / metrics.width))
        : columns,
      box ? Math.min(rows, Math.floor(box.clientHeight / metrics.height)) : rows
    );
    const satInner = inner(layout.sat);

    const pose = poseRef.current;
    updatePose(pose, pointer, satInner, delta, interactive);

    const pixelAspect = metrics.width / gx / (metrics.height / gy);
    drawSatellite(
      canvas,
      satInner,
      {
        pitch:
          0.38 +
          Math.sin(time * 0.23) * 0.12 +
          pose.tiltY * 0.6 +
          pose.dragPitch,
        yaw: time * 0.32 + pose.tiltX * 0.9 + pose.dragYaw,
      },
      time,
      pixelAspect
    );
    if (layout.scope) {
      drawScope(canvas, inner(layout.scope), time);
    }

    mapTones(
      canvas.field,
      columns,
      rows,
      {
        charset: set,
        colorMode: "palette",
        dither,
        edgeThreshold,
        grade,
        invert,
        threshold,
      },
      frame
    );
    colorCells(canvas, frame, ink, DECK.dim);

    drawChrome(frame, layout, {
      boxStyle,
      hostname,
      hover: interactive && pointer.inside ? pointer : null,
      ink,
      script,
      time,
    });
  };

  return (
    <AsciiGrid
      ref={rootRef}
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
