"use client";

import { useRef } from "react";
import type { ComponentProps, RefObject } from "react";

import {
  AsciiGrid,
  hexToRgb,
  PHOSPHORS,
  QUADRANT_GLYPHS,
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
  CharsetName,
  Rgb8,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/** Glyph sets the rain falls in: `latin` (the default) or any engine charset. */
export type GlyphRainCharset = "latin" | CharsetName;

export const GLYPH_RAIN_COLOR_MODES = ["truecolor", "mono", "duotone"] as const;
/**
 * - `truecolor`: trails in `color`, heads and the message in `accent`.
 * - `mono`: every glyph in `color`, or the phosphor's ink.
 * - `duotone`: glyphs coloured by brightness along `ramp`.
 */
export type GlyphRainColorMode = (typeof GLYPH_RAIN_COLOR_MODES)[number];

export interface GlyphRainProps
  extends
    Omit<
      AsciiLook,
      | "charset"
      | "colorMode"
      | "ansi"
      | "grade"
      | "invert"
      | "threshold"
      | "edgeThreshold"
      | "dither"
    >,
    Omit<ComponentProps<"div">, "children" | "color"> {
  /** Text the rain settles into, drawn large in block glyphs. Line breaks start new lines. Default: none, so the rain is ambient. */
  message?: string;
  /** Share of columns with a stream falling at once, from 0 to 1. Default 0.5. */
  density?: number;
  /** Fall speed multiplier. Default 1. */
  speed?: number;
  /** Seconds the finished message holds before it dissolves. Default 5. */
  hold?: number;
  /** Dissolve the message back into rain and reassemble it, forever. `false` forms it once and keeps it. Default `true`. */
  loop?: boolean;
  /** Glyphs the rain falls in, from faint at the tail to dense at the head. Default `"latin"`: digits, letters and a few symbols. */
  charset?: GlyphRainCharset;
  /** How glyphs are coloured. Default `"truecolor"`. */
  colorMode?: GlyphRainColorMode;
  /** Trail colour, and every glyph in `mono`. Default `"--ascii-ink"`. */
  color?: AsciiColor;
  /** Heads and the message in `truecolor`. Default `"orange"`, the palette's amber. */
  accent?: AsciiColor;
  /** Glyph cell height in CSS pixels. Default 12. */
  cell?: number;
  /** Frame rate cap. Default 30. */
  fps?: number;
  /** `false` holds one still frame with the message complete. Default `true`. */
  animate?: boolean;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

/* -------------------------------------------------------------------------- */
/* Glyphs                                                                      */
/* -------------------------------------------------------------------------- */

// Rough ink coverage order in a monospace font, faint to dense, so a trail
// thins out through the set as it fades.
const LATIN_RAIN =
  ".:;-=+*<>/?!17ilrtjcvxzsfunoeaky23456890qpdbghwmTYLJCVXZFEPKRSUNOAGHDBQWM#%&@";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const popcount = (mask: number) => {
  let bits = 0;
  for (let value = mask; value > 0; value = Math.floor(value / 2)) {
    bits += value % 2;
  }
  return bits;
};

/** The glyphs a stream can show, faint to dense. */
const rainPool = (
  charset: GlyphRainCharset,
  chars: string | undefined
): readonly string[] => {
  if (chars === undefined && charset === "latin") {
    return [...LATIN_RAIN];
  }
  const set = resolveCharset(charset === "latin" ? "standard" : charset, chars);
  if (set.kind === "braille" || set.kind === "quadrants") {
    // Indexed by dot mask, so order by how many dots each one lights.
    return set.glyphs
      .map((glyph, mask) => ({ bits: popcount(mask), glyph }))
      .filter(({ bits }) => bits > 0)
      .toSorted((a, b) => a.bits - b.bits)
      .map(({ glyph }) => glyph);
  }
  const glyphs = set.glyphs.filter((glyph) => glyph.trim() !== "");
  return glyphs.length > 0 ? glyphs : [...LATIN_RAIN];
};

// Shades a full message cell passes through while it fills in or wears away.
const SHADE_STEPS = ["░", "▒", "▓"] as const;

/* -------------------------------------------------------------------------- */
/* Block font                                                                  */
/* -------------------------------------------------------------------------- */

// A compact pixel font: rows top to bottom, `#` inked. Capitals and digits
// are 7 rows tall; lowercase has its x-height on rows 2 to 6 and descenders
// on rows 7 and 8. Glyphs are as wide as they need to be.
const FONT = {
  " ": "... ... ... ... ... ... ...",
  "!": "# # # # # . #",
  '"': "#.# #.# ... ... ... ... ...",
  "#": ".#.#. ##### .#.#. .#.#. .#.#. ##### .#.#.",
  "&": ".##.. #..#. #.#.. .#... #.#.# #..#. .##.#",
  "'": "# # . . . . .",
  "(": ".# #. #. #. #. #. .#",
  ")": "#. .# .# .# .# .# #.",
  "*": "..... #.#.# .###. ##### .###. #.#.# .....",
  "+": "..... ..#.. ..#.. ##### ..#.. ..#.. .....",
  ",": ".. .. .. .. .. .# .# #.",
  "-": "... ... ... ### ... ... ...",
  ".": ". . . . . . #",
  "/": "....# ....# ...#. ..#.. .#... #.... #....",
  "0": ".###. #...# #..## #.#.# ##..# #...# .###.",
  "1": "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.",
  "2": ".###. #...# ....# ...#. ..#.. .#... #####",
  "3": "####. ....# ....# .###. ....# ....# ####.",
  "4": "...#. ..##. .#.#. #..#. ##### ...#. ...#.",
  "5": "##### #.... ####. ....# ....# #...# .###.",
  "6": ".###. #.... #.... ####. #...# #...# .###.",
  "7": "##### ....# ...#. ..#.. .#... .#... .#...",
  "8": ".###. #...# #...# .###. #...# #...# .###.",
  "9": ".###. #...# #...# .#### ....# ....# .###.",
  ":": ". . # . . . #",
  "<": "...# ..#. .#.. #... .#.. ..#. ...#",
  "=": "..... ..... ##### ..... ##### ..... .....",
  ">": "#... .#.. ..#. ...# ..#. .#.. #...",
  "?": ".###. #...# ....# ...#. ..#.. ..... ..#..",
  "@": ".###. #...# #.### #.#.# #.### #.... .####",
  A: ".###. #...# #...# ##### #...# #...# #...#",
  B: "####. #...# #...# ####. #...# #...# ####.",
  C: ".#### #.... #.... #.... #.... #.... .####",
  D: "####. #...# #...# #...# #...# #...# ####.",
  E: "##### #.... #.... ####. #.... #.... #####",
  F: "##### #.... #.... ####. #.... #.... #....",
  G: ".#### #.... #.... #.### #...# #...# .####",
  H: "#...# #...# #...# ##### #...# #...# #...#",
  I: "### .#. .#. .#. .#. .#. ###",
  J: "..### ....# ....# ....# ....# #...# .###.",
  K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#",
  L: "#.... #.... #.... #.... #.... #.... #####",
  M: "#...# ##.## #.#.# #.#.# #...# #...# #...#",
  N: "#...# ##..# #.#.# #..## #...# #...# #...#",
  O: ".###. #...# #...# #...# #...# #...# .###.",
  P: "####. #...# #...# ####. #.... #.... #....",
  Q: ".###. #...# #...# #...# #.#.# #..#. .##.#",
  R: "####. #...# #...# ####. #.#.. #..#. #...#",
  S: ".#### #.... #.... .###. ....# ....# ####.",
  T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
  U: "#...# #...# #...# #...# #...# #...# .###.",
  V: "#...# #...# #...# #...# #...# .#.#. ..#..",
  W: "#...# #...# #...# #.#.# #.#.# ##.## #...#",
  X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
  Y: "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..",
  Z: "##### ....# ...#. ..#.. .#... #.... #####",
  "[": "## #. #. #. #. #. ##",
  "]": "## .# .# .# .# .# ##",
  _: "..... ..... ..... ..... ..... ..... #####",
  a: "..... ..... .###. ....# .#### #...# .####",
  b: "#.... #.... ####. #...# #...# #...# ####.",
  c: "..... ..... .#### #.... #.... #.... .####",
  d: "....# ....# .#### #...# #...# #...# .####",
  e: "..... ..... .###. #...# ##### #.... .####",
  f: "..## .#.. ###. .#.. .#.. .#.. .#..",
  g: "..... ..... .#### #...# #...# #...# .#### ....# .###.",
  h: "#.... #.... ####. #...# #...# #...# #...#",
  i: "# . # # # # #",
  j: "..# ... ..# ..# ..# ..# ..# ..# ##.",
  k: "#... #... #..# #.#. ##.. #.#. #..#",
  l: "#. #. #. #. #. #. .#",
  m: "..... ..... ####. #.#.# #.#.# #.#.# #.#.#",
  n: "..... ..... ####. #...# #...# #...# #...#",
  o: "..... ..... .###. #...# #...# #...# .###.",
  p: "..... ..... ####. #...# #...# #...# ####. #.... #....",
  q: "..... ..... .#### #...# #...# #...# .#### ....# ....#",
  r: ".... .... #.## ##.. #... #... #...",
  s: "..... ..... .#### #.... .###. ....# ####.",
  t: ".#.. .#.. ###. .#.. .#.. .#.. ..##",
  u: "..... ..... #...# #...# #...# #...# .####",
  v: "..... ..... #...# #...# #...# .#.#. ..#..",
  w: "..... ..... #...# #...# #.#.# #.#.# .#.#.",
  x: "..... ..... #...# .#.#. ..#.. .#.#. #...#",
  y: "..... ..... #...# #...# #...# #...# .#### ....# .###.",
  z: "..... ..... ##### ...#. ..#.. .#... #####",
  "|": "# # # # # # #",
} as const satisfies Record<string, string>;

const isFontKey = (glyph: string): glyph is keyof typeof FONT =>
  Object.hasOwn(FONT, glyph);

/** Rows of one font glyph; lowercase falls back to capitals, unknowns to `?`. */
const fontRows = (glyph: string): readonly string[] => {
  let key: keyof typeof FONT = "?";
  if (isFontKey(glyph)) {
    key = glyph;
  } else if (isFontKey(glyph.toUpperCase())) {
    key = glyph.toUpperCase() as keyof typeof FONT;
  } else if (glyph.trim() === "") {
    key = " ";
  }
  return FONT[key].split(" ");
};

const CAP_ROWS = 7;
const DESCENDER_ROWS = 9;
const LETTER_GAP = 1;
const LINE_GAP = 3;

interface Bitmap {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

/** The message set in the block font, every line centred. */
const setMessage = (message: string): Bitmap | null => {
  const lines = message
    .split("\n")
    .map((line) => [...line.trim()].map(fontRows))
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return null;
  }
  const widths = lines.map(
    (line) =>
      line.reduce((sum, rows) => sum + (rows[0]?.length ?? 0), 0) +
      LETTER_GAP * (line.length - 1)
  );
  const heights = lines.map((line) =>
    line.some((rows) => rows.length > CAP_ROWS) ? DESCENDER_ROWS : CAP_ROWS
  );
  const width = Math.max(...widths);
  const height =
    heights.reduce((sum, value) => sum + value, 0) +
    LINE_GAP * (lines.length - 1);
  const pixels = new Uint8Array(width * height);
  let top = 0;
  for (const [index, line] of lines.entries()) {
    let left = Math.floor((width - (widths[index] ?? 0)) / 2);
    for (const rows of line) {
      for (const [y, row] of rows.entries()) {
        for (let x = 0; x < row.length; x += 1) {
          if (row[x] === "#") {
            pixels[(top + y) * width + left + x] = 1;
          }
        }
      }
      left += (rows[0]?.length ?? 0) + LETTER_GAP;
    }
    top += (heights[index] ?? CAP_ROWS) + LINE_GAP;
  }
  return { height, pixels, width };
};

/** Where the message sits on the grid: a quadrant mask per cell and its bounds. */
interface Layout {
  /** Quadrant mask per cell: top-left 1, top-right 2, bottom-left 4, bottom-right 8. */
  readonly mask: Uint8Array;
  /** Indices of the cells with ink. */
  readonly cells: Int32Array;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * Scale the bitmap to the largest size that fits, in half cells, so each
 * font pixel is a whole number of quadrants and every edge is crisp.
 * Pixels stay close to square: cells are taller than they are wide, so a
 * pixel spans more half columns than half rows.
 */
const layoutMessage = (
  bitmap: Bitmap,
  columns: number,
  rows: number,
  cellWidth: number,
  cellHeight: number
): Layout | null => {
  const halfColumns = columns * 2;
  const halfRows = rows * 2;
  const fitWidth = Math.floor(halfColumns * 0.9);
  const fitHeight = Math.floor(halfRows * 0.6);
  // Half columns per pixel for a square pixel at `down` half rows.
  const square = cellHeight / cellWidth;
  let down = Math.max(1, Math.floor(fitHeight / bitmap.height));
  let wide = 1;
  for (; down >= 1; down -= 1) {
    // Up to a quarter narrower than square still reads as the same font.
    const widest = Math.floor(fitWidth / bitmap.width);
    wide = Math.min(widest, Math.round(down * square));
    if (wide >= Math.max(1, Math.floor(down * square * 0.75))) {
      break;
    }
  }
  down = Math.max(1, down);
  wide = Math.max(1, wide);
  const originX = Math.floor((halfColumns - bitmap.width * wide) / 2);
  // A touch above centre, where a headline sits.
  const originY = Math.floor((halfRows - bitmap.height * down) * 0.46);
  const mask = new Uint8Array(columns * rows);
  const inked = (hx: number, hy: number) => {
    const fx = Math.floor((hx - originX) / wide);
    const fy = Math.floor((hy - originY) / down);
    if (fx < 0 || fy < 0 || fx >= bitmap.width || fy >= bitmap.height) {
      return false;
    }
    return bitmap.pixels[fy * bitmap.width + fx] === 1;
  };
  const cells: number[] = [];
  let left = columns;
  let right = -1;
  let top = rows;
  let bottom = -1;
  const firstRow = Math.max(0, Math.floor(originY / 2));
  const lastRow = Math.min(
    rows - 1,
    Math.ceil((originY + bitmap.height * down) / 2)
  );
  const firstColumn = Math.max(0, Math.floor(originX / 2));
  const lastColumn = Math.min(
    columns - 1,
    Math.ceil((originX + bitmap.width * wide) / 2)
  );
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const hx = column * 2;
      const hy = row * 2;
      const bits =
        (inked(hx, hy) ? 1 : 0) +
        (inked(hx + 1, hy) ? 2 : 0) +
        (inked(hx, hy + 1) ? 4 : 0) +
        (inked(hx + 1, hy + 1) ? 8 : 0);
      if (bits > 0) {
        const index = row * columns + column;
        mask[index] = bits;
        cells.push(index);
        left = Math.min(left, column);
        right = Math.max(right, column);
        top = Math.min(top, row);
        bottom = Math.max(bottom, row);
      }
    }
  }
  if (cells.length === 0) {
    return null;
  }
  return { bottom, cells: Int32Array.from(cells), left, mask, right, top };
};

/* -------------------------------------------------------------------------- */
/* Simulation                                                                  */
/* -------------------------------------------------------------------------- */

type Phase = "forming" | "holding" | "dissolving" | "resting";

interface Stream {
  column: number;
  /** Head row, fractional; the trail runs up from it. */
  y: number;
  /** Rows per second at speed 1. */
  rate: number;
  length: number;
  /** Seconds before it starts falling. */
  wait: number;
}

interface Rain {
  key: string;
  columns: number;
  rows: number;
  random: () => number;
  /** A glyph choice per cell, from 0 to 1; re-rolled now and then. */
  seeds: Float32Array;
  streams: Stream[];
  /** How bright the rain is in each cell this frame, 0 to 1. */
  tone: Float32Array;
  /** How close each cell is behind a head, 1 at the head, for the warm tip. */
  warm: Float32Array;
  head: Uint8Array;
  layout: Layout | null;
  /** How far each message cell has settled, 0 (rain) to 1 (a solid letter). */
  settle: Float32Array;
  /** Phase time at which each message cell starts to settle or wear away. */
  due: Float32Array;
  phase: Phase;
  phaseTime: number;
}

// Seconds. A stream that misses a cell leaves it to a slow sweep after
// FORM_MAX, so the message always finishes.
const FORM_MAX = 5.5;
const FORM_SWEEP = 1.6;
const DISSOLVE_SWEEP = 3.4;
const REST = 1.8;
const SETTLE_IN = 0.75;
const SETTLE_OUT = 1.1;
const MUTATE_EVERY = 3.5;
const MAX_DELTA = 0.1;

/** A small seeded generator, so the still frame is the same on every draw. */
const seeded = (seed: number) => {
  let count = 0;
  return () => {
    count += 1;
    const value = Math.sin(count * 12.9898 + seed * 78.233) * 43_758.5453;
    return value - Math.floor(value);
  };
};

const streamLength = (rain: Rain) =>
  Math.round(
    Math.min(40, Math.max(6, rain.rows * (0.22 + rain.random() * 0.4)))
  );

/** Send a stream back to the top, biased toward the message while it forms. */
const respawn = (rain: Rain, stream: Stream) => {
  const { layout, random } = rain;
  const toMessage = layout !== null && rain.phase === "forming";
  stream.column =
    toMessage && random() < 0.7
      ? layout.left + Math.floor(random() * (layout.right - layout.left + 1))
      : Math.floor(random() * rain.columns);
  stream.length = streamLength(rain);
  stream.y = -random() * 6;
  stream.rate = 3 + random() * 6;
  stream.wait = random() * 1.4;
};

const createRain = (
  key: string,
  columns: number,
  rows: number,
  layout: Layout | null,
  density: number,
  start: "seeded" | "complete"
): Rain => {
  const cells = columns * rows;
  const random = seeded(columns * 0.731 + rows * 0.117);
  const rain: Rain = {
    columns,
    due: new Float32Array(cells),
    head: new Uint8Array(cells),
    key,
    layout,
    phase: layout ? "forming" : "resting",
    phaseTime: 0,
    random,
    rows,
    seeds: Float32Array.from({ length: cells }, () => random()),
    settle: new Float32Array(cells),
    streams: [],
    tone: new Float32Array(cells),
    warm: new Float32Array(cells),
  };
  const count = Math.max(1, Math.round(columns * density));
  // Ambient streams already mid-fall, so the first frame is full of rain.
  // Streams writing the message count toward the total, or the extra ones
  // would be retired as they leave and the top of the box would run dry.
  const fillAmbient = () => {
    const ambient = Math.max(
      Math.round(count * 0.5),
      count - rain.streams.length
    );
    for (let index = 0; index < ambient; index += 1) {
      const length = streamLength(rain);
      rain.streams.push({
        column: Math.floor(random() * columns),
        length,
        rate: 3 + random() * 6,
        wait: 0,
        y: random() * (rows + length),
      });
    }
  };
  if (!layout) {
    fillAmbient();
    return rain;
  }
  if (start === "complete") {
    rain.phase = "holding";
    for (const index of layout.cells) {
      rain.settle[index] = 1;
    }
    fillAmbient();
    return rain;
  }
  // Part way through forming: some columns written, some being written by
  // a stream right now, the rest still to come.
  rain.phaseTime = FORM_MAX * 0.5;
  rain.due.fill(Number.POSITIVE_INFINITY);
  for (const index of layout.cells) {
    rain.due[index] = FORM_MAX + random() * FORM_SWEEP;
  }
  for (let column = layout.left; column <= layout.right; column += 1) {
    const roll = random();
    if (roll > 0.9) {
      continue;
    }
    const span = layout.bottom - layout.top + 1;
    const done = roll < 0.58;
    // Columns being written are mostly past their top half, so the word
    // already reads.
    const headRow = done
      ? layout.bottom + 1 + Math.floor(random() * 8)
      : layout.top + Math.floor(span * (0.3 + random() * 0.7));
    for (
      let row = layout.top;
      row <= Math.min(headRow, layout.bottom);
      row += 1
    ) {
      const index = row * columns + column;
      if ((layout.mask[index] ?? 0) === 0) {
        continue;
      }
      rain.due[index] = 0;
      // Cells just behind the head are still filling in.
      rain.settle[index] = Math.min(1, (headRow - row) / 4);
    }
    if (!done || random() < 0.5) {
      rain.streams.push({
        column,
        length: streamLength(rain),
        rate: 3 + random() * 6,
        wait: 0,
        y: headRow + 0.5,
      });
    }
  }
  fillAmbient();
  return rain;
};

const startPhase = (rain: Rain, phase: Phase) => {
  rain.phase = phase;
  rain.phaseTime = 0;
  const { layout, random, due } = rain;
  if (!layout) {
    return;
  }
  for (const index of layout.cells) {
    if (phase === "forming") {
      due[index] = FORM_MAX + random() * FORM_SWEEP;
    } else if (phase === "dissolving") {
      due[index] = random() * DISSOLVE_SWEEP;
    }
  }
};

/** Move every stream, marking the message cells its head crosses. */
const moveStreams = (
  rain: Rain,
  delta: number,
  speed: number,
  target: number
) => {
  const { layout, columns, rows, streams, due } = rain;
  const touching = rain.phase === "forming" || rain.phase === "dissolving";
  for (let index = streams.length - 1; index >= 0; index -= 1) {
    const stream = streams[index];
    if (!stream) {
      continue;
    }
    if (stream.wait > 0) {
      stream.wait -= delta;
      continue;
    }
    const from = Math.floor(stream.y);
    stream.y += stream.rate * speed * delta;
    // Only while the message forms or wears away; otherwise no rows.
    const to = touching ? Math.min(rows - 1, Math.floor(stream.y)) : -1;
    // A head crossing a message cell writes it (or wears it away) now.
    for (let row = Math.max(0, from + 1); row <= to; row += 1) {
      const cell = row * columns + stream.column;
      if ((layout?.mask[cell] ?? 0) > 0) {
        due[cell] = Math.min(due[cell] ?? 0, rain.phaseTime);
      }
    }
    if (stream.y - stream.length <= rows) {
      continue;
    }
    if (streams.length > target) {
      streams.splice(index, 1);
    } else {
      respawn(rain, stream);
    }
  }
  while (streams.length < target) {
    const stream: Stream = { column: 0, length: 0, rate: 0, wait: 0, y: 0 };
    respawn(rain, stream);
    streams.push(stream);
  }
};

/** Glyphs in place change now and then. */
const mutateGlyphs = (rain: Rain, delta: number) => {
  const { seeds, random } = rain;
  const mutations = Math.round((seeds.length * delta) / MUTATE_EVERY);
  for (let index = 0; index < mutations; index += 1) {
    seeds[Math.floor(random() * seeds.length)] = random();
  }
};

/** Fill in or wear away the message cells that are due, then change phase. */
const advanceMessage = (
  rain: Rain,
  layout: Layout,
  delta: number,
  hold: number,
  loop: boolean
) => {
  const { settle, due, phase, phaseTime } = rain;
  const change =
    (phase === "forming" ? delta / SETTLE_IN : 0) -
    (phase === "dissolving" ? delta / SETTLE_OUT : 0);
  let settled = 0;
  let cleared = 0;
  for (const cell of layout.cells) {
    let value = settle[cell] ?? 0;
    if (phaseTime >= (due[cell] ?? 0)) {
      value = clamp01(value + change);
      settle[cell] = value;
    }
    settled += value >= 1 ? 1 : 0;
    cleared += value <= 0 ? 1 : 0;
  }
  const total = layout.cells.length;
  if (phase === "forming" && settled === total) {
    startPhase(rain, "holding");
  } else if (phase === "holding" && loop && phaseTime >= hold) {
    startPhase(rain, "dissolving");
  } else if (phase === "dissolving" && cleared === total) {
    startPhase(rain, "resting");
  } else if (phase === "resting" && phaseTime >= REST) {
    startPhase(rain, "forming");
  }
};

/** Brightness, warmth and head flags for every cell a trail covers. */
const lightTrails = (rain: Rain) => {
  const { tone, warm, head, columns, rows } = rain;
  tone.fill(0);
  warm.fill(0);
  head.fill(0);
  for (const stream of rain.streams) {
    const headRow = Math.floor(stream.y);
    const first = Math.max(0, headRow - rows + 1);
    const last = Math.min(stream.length, headRow);
    for (let k = first; stream.wait <= 0 && k <= last; k += 1) {
      const index = (headRow - k) * columns + stream.column;
      const value = k === 0 ? 1 : (1 - k / (stream.length + 1)) ** 1.2 * 0.9;
      if (value > (tone[index] ?? 0)) {
        tone[index] = value;
        warm[index] = k === 0 ? 1 : Math.max(0, 0.5 - (k - 1) * 0.25);
        head[index] = k === 0 ? 1 : 0;
      }
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Colour                                                                      */
/* -------------------------------------------------------------------------- */

const toBytes = (rgba: readonly number[] | undefined, fallback: Rgb8): Rgb8 =>
  rgba
    ? [
        Math.round((rgba[0] ?? 0) * 255),
        Math.round((rgba[1] ?? 0) * 255),
        Math.round((rgba[2] ?? 0) * 255),
      ]
    : fallback;

const mix = (a: Rgb8, b: Rgb8, t: number): Rgb8 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

interface Paint {
  /** Colour of a rain cell from its brightness and closeness to the head. */
  readonly rain: (tone: number, warm: number) => Rgb8;
  readonly message: Rgb8;
}

const rampStops = (ramp: AsciiLook["ramp"]): readonly Rgb8[] => {
  if (ramp === undefined) {
    return RAMPS.sodium.map(hexToRgb);
  }
  if (typeof ramp === "string") {
    return (RAMPS[ramp as keyof typeof RAMPS] ?? RAMPS.sodium).map(hexToRgb);
  }
  return ramp.map(hexToRgb);
};

const pickPaint = (
  mode: GlyphRainColorMode,
  ink: Rgb8,
  accent: Rgb8,
  stops: readonly Rgb8[]
): Paint => {
  if (mode === "duotone") {
    return {
      message: sampleRamp(stops, 1),
      rain: (tone) => sampleRamp(stops, 0.3 + 0.7 * tone),
    };
  }
  if (mode === "mono") {
    return { message: ink, rain: () => ink };
  }
  return { message: accent, rain: (_tone, warm) => mix(ink, accent, warm) };
};

const rampPaper = (ramp: AsciiLook["ramp"]): string => {
  if (typeof ramp === "string") {
    return (RAMPS[ramp as keyof typeof RAMPS] ?? RAMPS.sodium)[0];
  }
  return ramp?.[0] ?? RAMPS.sodium[0];
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

const writeCell = (
  colors: Uint8ClampedArray | null,
  index: number,
  rgb: Rgb8,
  alpha: number
) => {
  if (!colors) {
    return;
  }
  const at = index * 4;
  const [r, g, b] = rgb;
  colors[at] = r;
  colors[at + 1] = g;
  colors[at + 2] = b;
  // Alpha 0 would mean "use the ink colour", so the faintest glyph keeps 1.
  colors[at + 3] = Math.max(1, Math.round(alpha * 255));
};

interface Compose {
  readonly rain: Rain;
  readonly pool: readonly string[];
  readonly paint: Paint;
  readonly glyphs: string[];
  readonly colors: Uint8ClampedArray | null;
  /** Cells around the message where trails sink back, or null. */
  readonly box: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null;
}

/** A message cell part way between rain and a solid letter. */
const messageCell = (
  { rain, pool }: Compose,
  bits: number,
  settled: number
): readonly [string, number] => {
  const solid = QUADRANT_GLYPHS[bits] ?? "█";
  if (settled >= 0.82) {
    return [solid, 1];
  }
  // Forming, a cell starts as a dense glyph in the accent that changes
  // every frame; wearing away, it only thins out.
  const from = rain.phase === "forming" ? 0.3 : 0;
  if (settled < from) {
    const pick = 0.7 + rain.random() * 0.3;
    return [
      pool[Math.round(pick * (pool.length - 1))] ?? solid,
      0.45 + settled,
    ];
  }
  if (bits === 15) {
    const level = Math.floor(((settled - from) / (0.82 - from)) * 3);
    return [SHADE_STEPS[Math.min(2, level)] ?? solid, 0.5 + settled * 0.6];
  }
  return [solid, 0.3 + settled * 0.8];
};

/**
 * How strong the drop shadow is in a cell: a shade one cell down and
 * right of each letter cell, like an ANSI banner's.
 */
const shadowAt = (rain: Rain, index: number, column: number, row: number) => {
  const { layout, columns, settle } = rain;
  if (!layout || row === 0 || column === 0) {
    return 0;
  }
  const caster = index - columns - 1;
  const lit = (layout.mask[caster] ?? 0) > 0 ? (settle[caster] ?? 0) : 0;
  return lit >= 0.82 ? lit : 0;
};

const rainCell = (
  compose: Compose,
  index: number,
  column: number,
  row: number
) => {
  const { rain, pool, paint, box, glyphs, colors } = compose;
  const value = rain.tone[index] ?? 0;
  if (value <= 0.02) {
    return;
  }
  const pick = clamp01(value * 0.7 + (rain.seeds[index] ?? 0) * 0.3);
  glyphs[index] = pool[Math.round(pick * (pool.length - 1))] ?? " ";
  const isHead = rain.head[index] === 1;
  let alpha = isHead ? 1 : 0.08 + 0.72 * value;
  // Behind the message the trails sink back, so the letters read.
  if (
    box &&
    column >= box.left &&
    column <= box.right &&
    row >= box.top &&
    row <= box.bottom
  ) {
    alpha *= isHead ? 0.8 : 0.35;
  }
  writeCell(colors, index, paint.rain(value, rain.warm[index] ?? 0), alpha);
};

/** Write one frame of glyphs and colours from the rain and the message. */
const compose = (input: Compose) => {
  const { rain, paint, glyphs, colors } = input;
  const { columns, rows, layout, settle } = rain;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const bits = layout?.mask[index] ?? 0;
      const settled = settle[index] ?? 0;
      const shadow = bits === 0 ? shadowAt(rain, index, column, row) : 0;
      if (bits > 0 && settled > 0) {
        const [glyph, alpha] = messageCell(input, bits, settled);
        glyphs[index] = glyph;
        writeCell(colors, index, paint.message, alpha);
      } else if (shadow > 0) {
        glyphs[index] = "░";
        writeCell(colors, index, paint.message, 0.5 * shadow);
      } else {
        rainCell(input, index, column, row);
      }
    }
  }
};

/**
 * Glyph rain. Columns of glyphs fall at different speeds, each with a
 * bright head and a trail that thins out through the charset, and glyphs
 * in the trails change now and then. Given a `message`, the streams that
 * cross its cells leave its letters behind in block glyphs, so the
 * headline writes itself out of the rain, holds, wears away and forms
 * again. Under reduced motion it draws the finished message once.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const GlyphRain = ({
  message,
  density = 0.5,
  speed = 1,
  hold = 5,
  loop = true,
  charset = "latin",
  chars,
  colorMode = "truecolor",
  color = "--ascii-ink",
  accent = "orange",
  phosphor,
  ramp,
  background,
  fx,
  cell = 12,
  fps = 30,
  animate = true,
  handle,
  className,
  "aria-hidden": ariaHidden = true,
  ...props
}: GlyphRainProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const rainRef = useRef<Rain | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const still = !animate || reducedMotion;
  const theme = useAsciiColors(rootRef, [color, accent]);

  const preset =
    phosphor && colorMode === "mono" ? PHOSPHORS[phosphor] : undefined;
  const ink: Rgb8 = preset
    ? hexToRgb(preset.ink)
    : toBytes(theme?.[0], [230, 230, 230]);
  const amber = toBytes(theme?.[1], [246, 168, 66]);
  const paint = pickPaint(colorMode, ink, amber, rampStops(ramp));
  // Phosphor and duotone bring their own glass; otherwise the page shows through.
  let paper: AsciiColor = "transparent";
  if (background === "paper") {
    paper = "--ascii-paper";
  }
  if (background !== "transparent" && preset) {
    ({ paper } = preset);
  } else if (background !== "transparent" && colorMode === "duotone") {
    paper = rampPaper(ramp);
  }
  const pool = rainPool(charset, chars);
  const bitmap = message ? setMessage(message) : null;
  const fill = clamp01(density);

  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    delta,
  }: AsciiGridDrawContext) => {
    const key = `${columns}x${rows}:${message ?? ""}:${fill}:${still ? 1 : 0}`;
    let rain = rainRef.current;
    if (!rain || rain.key !== key) {
      const layout = bitmap
        ? layoutMessage(bitmap, columns, rows, metrics.width, metrics.height)
        : null;
      // The first frame shows the message part written; after a resize it
      // comes back whole rather than starting over.
      rain = createRain(
        key,
        columns,
        rows,
        layout,
        fill,
        still || rainRef.current ? "complete" : "seeded"
      );
      rainRef.current = rain;
    }
    if (!still && delta > 0) {
      const dt = Math.min(delta, MAX_DELTA);
      rain.phaseTime += dt;
      moveStreams(
        rain,
        dt,
        Math.max(0, speed),
        Math.max(1, Math.round(columns * fill))
      );
      mutateGlyphs(rain, dt);
      if (rain.layout) {
        advanceMessage(rain, rain.layout, dt, Math.max(0, hold), loop);
      }
    }
    lightTrails(rain);
    const { layout } = rain;
    compose({
      box:
        layout && rain.phase !== "resting"
          ? {
              bottom: layout.bottom + 1,
              left: layout.left - 2,
              right: layout.right + 2,
              top: layout.top - 1,
            }
          : null,
      colors: frame.colors,
      glyphs: frame.glyphs,
      paint,
      pool,
      rain,
    });
  };

  return (
    <div
      ref={rootRef}
      aria-hidden={ariaHidden}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <AsciiGrid
        draw={draw}
        cell={cell}
        ink={preset ? preset.ink : color}
        paper={paper}
        colored
        fps={fps}
        animate={animate}
        handle={handle}
        fx={fx}
        className="absolute inset-0"
      />
    </div>
  );
};
