"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, RefObject } from "react";

import {
  AsciiGrid,
  BRAILLE_DOT_BITS,
  brailleChar,
  cssColor,
  hexToRgb,
  measureCell,
  QUADRANT_BITS,
  QUADRANT_GLYPHS,
  quadrantChar,
  RAMPS,
  readFont,
  resolveCharset,
  sampleRamp,
  useAsciiColors,
  useDocumentVisible,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiGridDrawContext,
  AsciiHandle,
  CellMetrics,
  CharsetName,
  MutableFrame,
  PostFx,
  RampName,
  Rgb8,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

// A 5x7 pixel font: rows top to bottom, split by "/", "#" for an inked
// pixel. Digits for the clock, capitals and a little punctuation for
// `doneText`. Anything else draws as "?".
const FONT = {
  "!": "..#../..#../..#../..#../..#../...../..#..",
  "-": "...../...../...../.###./...../...../.....",
  ".": "...../...../...../...../...../.##../.##..",
  "/": "....#/....#/...#./..#../.#.../#..../#....",
  "0": ".###./#...#/#...#/#...#/#...#/#...#/.###.",
  "1": "..#../.##../..#../..#../..#../..#../.###.",
  "2": ".###./#...#/....#/...#./..#../.#.../#####",
  "3": "#####/...#./..#../...#./....#/#...#/.###.",
  "4": "...#./..##./.#.#./#..#./#####/...#./...#.",
  "5": "#####/#..../####./....#/....#/#...#/.###.",
  "6": "..##./.#.../#..../####./#...#/#...#/.###.",
  "7": "#####/....#/...#./..#../.#.../.#.../.#...",
  "8": ".###./#...#/#...#/.###./#...#/#...#/.###.",
  "9": ".###./#...#/#...#/.####/....#/...#./.##..",
  "?": ".###./#...#/....#/...#./..#../...../..#..",
  A: ".###./#...#/#...#/#####/#...#/#...#/#...#",
  B: "####./#...#/#...#/####./#...#/#...#/####.",
  C: ".###./#...#/#..../#..../#..../#...#/.###.",
  D: "####./#...#/#...#/#...#/#...#/#...#/####.",
  E: "#####/#..../#..../####./#..../#..../#####",
  F: "#####/#..../#..../####./#..../#..../#....",
  G: ".###./#...#/#..../#.###/#...#/#...#/.####",
  H: "#...#/#...#/#...#/#####/#...#/#...#/#...#",
  I: ".###./..#../..#../..#../..#../..#../.###.",
  J: "..###/...#./...#./...#./...#./#..#./.##..",
  K: "#...#/#..#./#.#../##.../#.#../#..#./#...#",
  L: "#..../#..../#..../#..../#..../#..../#####",
  M: "#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#",
  N: "#...#/#...#/##..#/#.#.#/#..##/#...#/#...#",
  O: ".###./#...#/#...#/#...#/#...#/#...#/.###.",
  P: "####./#...#/#...#/####./#..../#..../#....",
  Q: ".###./#...#/#...#/#...#/#.#.#/#..#./.##.#",
  R: "####./#...#/#...#/####./#.#../#..#./#...#",
  S: ".####/#..../#..../.###./....#/....#/####.",
  T: "#####/..#../..#../..#../..#../..#../..#..",
  U: "#...#/#...#/#...#/#...#/#...#/#...#/.###.",
  V: "#...#/#...#/#...#/#...#/#...#/.#.#./..#..",
  W: "#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.",
  X: "#...#/#...#/.#.#./..#../.#.#./#...#/#...#",
  Y: "#...#/#...#/.#.#./..#../..#../..#../..#..",
  Z: "#####/....#/...#./..#../.#.../#..../#####",
} as const satisfies Record<string, string>;

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
/** Font pixels between the digits of one group. */
const DIGIT_GAP = 1;
/** Font pixels on each side of a colon. */
const COLON_SPACE = 2;
/** Font pixels a space takes in `doneText`. */
const WORD_SPACE = 3;
/** Width over height of one font pixel on screen: a touch wide reads as type. */
const PIXEL_ASPECT = 1.15;
/** Height of the label band under each row of digits, in CSS pixels. */
const LABEL_BAND = 24;
/** Below this digit height on one row, a two-row layout is tried. */
const STACK_BELOW = 40;
/** How often a scrambling cell picks a new glyph, in milliseconds. */
const SCRAMBLE_STEP = 70;
/** Ghost pixels, in alpha out of 255: present, never louder than the digits. */
const GHOST_ALPHA = 46;

const parseGlyph = (rows: string): Uint8Array =>
  Uint8Array.from(rows.replaceAll("/", ""), (char) => (char === "#" ? 1 : 0));

const BITMAPS: ReadonlyMap<string, Uint8Array> = new Map(
  Object.entries(FONT).map(([char, rows]) => [char, parseGlyph(rows)])
);
const UNKNOWN = parseGlyph(FONT["?"]);
const BLANK = new Uint8Array(GLYPH_WIDTH * GLYPH_HEIGHT);
// One pixel wide, with dots on the third and fifth rows: centred on the digits.
const COLON = Uint8Array.from([0, 0, 1, 0, 1, 0, 0]);

const bitmapOf = (char: string): Uint8Array => BITMAPS.get(char) ?? UNKNOWN;

const DEFAULT_LABELS = ["DAYS", "HRS", "MIN", "SEC"] as const;

export const ASCII_COUNTDOWN_ACCENTS = [
  "seconds",
  "colons",
  "both",
  "none",
] as const;
/** Which parts of the clock take the `accent` colour. */
export type AsciiCountdownAccent = (typeof ASCII_COUNTDOWN_ACCENTS)[number];

/** Days, hours, minutes and seconds, in that order. */
export type AsciiCountdownLabels = readonly [string, string, string, string];

// How the cells are split into samples, and the glyphs each split uses.
interface Sampling {
  /** Samples per cell across and down. */
  readonly gx: number;
  readonly gy: number;
  /** The bit each sample sets in a cell's mask, row by row. */
  readonly bits: readonly number[];
  /** The glyph for a cell's mask. */
  readonly glyph: (mask: number) => string;
  /** Drawn on an unlit pixel. */
  readonly ghost: string;
  /** Glyphs a changing cell runs through before it settles. */
  readonly pool: readonly string[];
}

const HALF_BLOCKS = [" ", "▀", "▄", "█"] as const;
const BLOCK_POOL = [..."▓▒░▚▞▙▟▛▜▖▗▘▝"];
const QUADRANT_POOL = QUADRANT_GLYPHS.slice(1);
// A fixed spread of dot patterns, so the scramble is the same every visit.
const BRAILLE_POOL = Array.from({ length: 48 }, (_, index) =>
  brailleChar(((index * 97 + 31) % 254) + 1)
);

const samplingFor = (
  charset: CharsetName,
  chars: string | undefined
): Sampling => {
  const resolved = resolveCharset(charset, chars);
  // The block charset is drawn with half blocks: two pixels a cell, so the
  // digits are twice as fine as whole blocks and still have no seams.
  if (chars === undefined && resolved.id === "blocks") {
    return {
      bits: [1, 2],
      ghost: "·",
      glyph: (mask) => HALF_BLOCKS[mask] ?? " ",
      gx: 1,
      gy: 2,
      pool: BLOCK_POOL,
    };
  }
  if (resolved.kind === "quadrants") {
    return {
      bits: QUADRANT_BITS.flat(),
      ghost: "·",
      glyph: quadrantChar,
      gx: 2,
      gy: 2,
      pool: QUADRANT_POOL,
    };
  }
  if (resolved.kind === "braille") {
    return {
      bits: BRAILLE_DOT_BITS.flat(),
      ghost: "⠂",
      glyph: brailleChar,
      gx: 2,
      gy: 4,
      pool: BRAILLE_POOL,
    };
  }
  // A ramp: every inked cell is its densest glyph.
  const inked = resolved.glyphs.filter((glyph) => glyph !== " ");
  const solid = inked.at(-1) ?? "#";
  const ghost = inked[0] ?? "·";
  return {
    bits: [1],
    ghost: ghost === solid ? "·" : ghost,
    glyph: (mask) => (mask ? solid : " "),
    gx: 1,
    gy: 1,
    pool: inked.length > 1 ? inked : ["#", "%", "@", "&"],
  };
};

type Tone = "ink" | "accent";

// One glyph of the layout, at a font-pixel offset in its line.
interface Piece {
  readonly key: string;
  readonly char: string;
  readonly bitmap: Uint8Array;
  readonly width: number;
  readonly x: number;
  readonly line: number;
  readonly tone: Tone;
  readonly blink: boolean;
}

interface LabelSpan {
  readonly text: string;
  readonly x: number;
  readonly width: number;
  readonly line: number;
}

interface Arrangement {
  /** Width of each line in font pixels. */
  readonly widths: readonly number[];
  readonly pieces: readonly Piece[];
  readonly labels: readonly LabelSpan[];
}

interface Group {
  readonly key: string;
  readonly value: string;
  readonly label: string;
  readonly tone: Tone;
}

const arrangeGroups = (
  groups: readonly Group[],
  lines: readonly number[],
  colonTone: Tone
): Arrangement => {
  const pieces: Piece[] = [];
  const labels: LabelSpan[] = [];
  const widths: number[] = [];
  let next = 0;
  for (const [line, count] of lines.entries()) {
    let x = 0;
    for (const [slot, group] of groups.slice(next, next + count).entries()) {
      if (slot > 0) {
        x += COLON_SPACE;
        pieces.push({
          bitmap: COLON,
          blink: true,
          char: ":",
          key: `colon-${group.key}`,
          line,
          tone: colonTone,
          width: 1,
          x,
        });
        x += 1 + COLON_SPACE;
      }
      const start = x;
      for (const [index, char] of [...group.value].entries()) {
        if (index > 0) {
          x += DIGIT_GAP;
        }
        pieces.push({
          bitmap: bitmapOf(char),
          blink: false,
          char,
          // Keyed from the right, so a day count that grows a digit keeps
          // its units in place.
          key: `${group.key}-${group.value.length - index}`,
          line,
          tone: group.tone,
          width: GLYPH_WIDTH,
          x,
        });
        x += GLYPH_WIDTH;
      }
      labels.push({ line, text: group.label, width: x - start, x: start });
    }
    widths.push(x);
    next += count;
  }
  return { labels, pieces, widths };
};

const arrangeText = (text: string, tone: Tone): Arrangement => {
  const pieces: Piece[] = [];
  let x = 0;
  for (const [index, char] of [...text.toUpperCase()].entries()) {
    if (char === " ") {
      x += WORD_SPACE;
      continue;
    }
    if (pieces.length > 0) {
      x += DIGIT_GAP;
    }
    pieces.push({
      bitmap: bitmapOf(char),
      blink: false,
      char,
      key: `text-${index}`,
      line: 0,
      tone,
      width: GLYPH_WIDTH,
      x,
    });
    x += GLYPH_WIDTH;
  }
  return { labels: [], pieces, widths: [x] };
};

/** Font-pixel size in samples. */
interface Scale {
  readonly pw: number;
  readonly ph: number;
}

const digitRows = (ph: number, sampling: Sampling) =>
  Math.ceil((GLYPH_HEIGHT * ph) / sampling.gy);

/**
 * The largest font pixel that fits `columns`, and `rows` when given,
 * starting from the tallest that `size` allows. The width may give a
 * little (to 0.8 of square) before the height steps down.
 */
const fitScale = (
  width: number,
  heightOf: (ph: number) => number,
  columns: number,
  rows: number,
  maxPh: number,
  sampling: Sampling,
  aspect: number
): Scale | null => {
  for (let ph = maxPh; ph >= 1; ph -= 1) {
    if (heightOf(ph) > rows) {
      continue;
    }
    const ideal = (PIXEL_ASPECT * ph * sampling.gx) / (sampling.gy * aspect);
    const least = Math.max(1, Math.ceil(ideal * 0.8));
    for (let pw = Math.max(1, Math.round(ideal)); pw >= least; pw -= 1) {
      if (Math.ceil((width * pw) / sampling.gx) <= columns) {
        return { ph, pw };
      }
    }
  }
  return null;
};

interface Plan {
  readonly arrangement: Arrangement;
  readonly scale: Scale;
  readonly digitRows: number;
  /** Cell rows of the label band under each line. */
  readonly labelRows: number;
  /** Top cell row of each line. */
  readonly lineTops: readonly number[];
  readonly rows: number;
}

const maxPhFor = (size: number, metrics: CellMetrics, sampling: Sampling) =>
  Math.max(
    1,
    Math.floor((size * sampling.gy) / (GLYPH_HEIGHT * metrics.height))
  );

const buildPlan = (
  arrangement: Arrangement,
  scale: Scale,
  sampling: Sampling,
  labelRows: number
): Plan => {
  const body = digitRows(scale.ph, sampling);
  const gap = Math.max(1, Math.round(body / 3));
  const lineTops = arrangement.widths.map(
    (_, line) => line * (body + labelRows + gap)
  );
  const lines = arrangement.widths.length;
  return {
    arrangement,
    digitRows: body,
    labelRows,
    lineTops,
    rows: lines * (body + labelRows) + (lines - 1) * gap,
    scale,
  };
};

/** Cell heights tried, largest first, when `cell` is not set. */
const FIT_CELLS = [
  12, 11, 10, 9, 8, 7, 6, 5,
] as const satisfies readonly number[];

/** A cell size and the countdown laid out in it. */
interface Fit {
  /** Cell height in CSS pixels. */
  readonly cell: number;
  readonly metrics: CellMetrics;
  readonly columns: number;
  /** Groups per line. */
  readonly split: readonly number[];
  readonly plan: Plan;
  /** Digit height in CSS pixels. */
  readonly height: number;
}

interface FitInput {
  readonly groups: readonly Group[];
  readonly colonTone: Tone;
  readonly showLabels: boolean;
  readonly width: number;
  readonly font: string;
  readonly cell: number | undefined;
  readonly sampling: Sampling;
  readonly size: number;
}

/** The biggest digits for one split of the groups over all cell sizes. */
const bestFit = (input: FitInput, split: readonly number[]): Fit | null => {
  const { groups, colonTone, showLabels, width, font, cell, sampling, size } =
    input;
  const arrangement = arrangeGroups(groups, split, colonTone);
  const widest = Math.max(...arrangement.widths);
  let best: Fit | null = null;
  for (const candidate of cell === undefined ? FIT_CELLS : [cell]) {
    const metrics = measureCell({ cell: candidate, font });
    const columns = Math.floor(width / metrics.width);
    const scale = fitScale(
      widest,
      () => 0,
      columns,
      Number.POSITIVE_INFINITY,
      maxPhFor(size, metrics, sampling),
      sampling,
      metrics.width / metrics.height
    );
    if (!scale) {
      continue;
    }
    const height = (scale.ph * GLYPH_HEIGHT * metrics.height) / sampling.gy;
    // Bigger cells win near-ties: fewer, chunkier glyphs read better.
    if (!best || height > best.height * 1.04) {
      const labelRows = showLabels ? Math.ceil(LABEL_BAND / metrics.height) : 0;
      best = {
        cell: candidate,
        columns,
        height,
        metrics,
        plan: buildPlan(arrangement, scale, sampling, labelRows),
        split,
      };
    }
  }
  return best;
};

/**
 * The countdown on one line, or on two when one line would make the
 * digits smaller than `STACK_BELOW`, at the cell size that gives the
 * largest digits.
 */
const fitCountdown = (input: FitInput): Fit => {
  const { groups, size, cell, font, sampling, colonTone } = input;
  const count = groups.length;
  const one = bestFit(input, [count]);
  if (one && (one.height >= Math.min(STACK_BELOW, size) || count < 2)) {
    return one;
  }
  const top = Math.ceil(count / 2);
  const two = bestFit(input, [top, count - top]);
  if (two && (!one || two.height > one.height)) {
    return two;
  }
  if (one) {
    return one;
  }
  // Nothing fits: the smallest size, clipped at the edges.
  const smallest = cell ?? FIT_CELLS.at(-1) ?? 5;
  const metrics = measureCell({ cell: smallest, font });
  return {
    cell: smallest,
    columns: Math.floor(input.width / metrics.width),
    height: 0,
    metrics,
    plan: buildPlan(
      arrangeGroups(groups, [count], colonTone),
      { ph: 1, pw: 1 },
      sampling,
      0
    ),
    split: [count],
  };
};

/** `doneText` as large as the countdown's box allows. */
const planDone = (
  text: string,
  rows: number,
  columns: number,
  metrics: CellMetrics,
  sampling: Sampling,
  size: number
): Plan => {
  const arrangement = arrangeText(text, "accent");
  const scale = fitScale(
    arrangement.widths[0] ?? 0,
    (ph) => digitRows(ph, sampling),
    columns,
    rows,
    maxPhFor(size * 1.5, metrics, sampling),
    sampling,
    metrics.width / metrics.height
  ) ?? { ph: 1, pw: 1 };
  return buildPlan(arrangement, scale, sampling, 0);
};

interface Parts {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

const partsOf = (remaining: number): Parts => {
  // Rounded up, so the clock reads 00:00:01 in its last second and turns
  // to `doneText` at zero instead of holding 00:00:00 for a second.
  const total = Math.max(0, Math.ceil(remaining / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  };
};

const pad = (value: number) => String(value).padStart(2, "0");

const groupsOf = (
  parts: Parts,
  labels: AsciiCountdownLabels | false,
  showDays: boolean,
  accentOn: AsciiCountdownAccent
): Group[] => {
  const names = labels === false ? DEFAULT_LABELS : labels;
  const secondsTone: Tone =
    accentOn === "seconds" || accentOn === "both" ? "accent" : "ink";
  const groups: Group[] = [
    { key: "hours", label: names[1], tone: "ink", value: pad(parts.hours) },
    { key: "minutes", label: names[2], tone: "ink", value: pad(parts.minutes) },
    {
      key: "seconds",
      label: names[3],
      tone: secondsTone,
      value: pad(parts.seconds),
    },
  ];
  if (showDays) {
    groups.unshift({
      key: "days",
      label: names[0],
      tone: "ink",
      value: pad(parts.days),
    });
  }
  return groups;
};

const toTime = (value: Date | string | number): number | null => {
  let time = Number.NaN;
  if (value instanceof Date) {
    time = value.getTime();
  } else if (typeof value === "number") {
    time = value;
  } else {
    time = Date.parse(value);
  }
  return Number.isFinite(time) ? time : null;
};

// A float hash in [0, 1): cheap, stable for integer inputs, no bitwise maths.
// Inputs are kept small so `sin` keeps its precision.
const hash01 = (a: number, b: number): number => {
  const value =
    Math.sin((a % 65_536) * 127.1 + (b % 10_000) * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

const toBytes = (rgba: readonly number[] | undefined, fallback: Rgb8): Rgb8 =>
  rgba
    ? [
        Math.round((rgba[0] ?? 0) * 255),
        Math.round((rgba[1] ?? 0) * 255),
        Math.round((rgba[2] ?? 0) * 255),
      ]
    : fallback;

const rampStops = (ramp: RampName | readonly string[]): Rgb8[] =>
  (typeof ramp === "string" ? RAMPS[ramp] : ramp).map((stop) => hexToRgb(stop));

/** Per-cell scratch buffers, reused while the grid keeps its size. */
interface Buffers {
  size: number;
  mask: Uint8Array;
  before: Uint8Array;
  ghost: Uint8Array;
  owner: Int16Array;
}

const makeBuffers = (size: number): Buffers => ({
  before: new Uint8Array(size),
  ghost: new Uint8Array(size),
  mask: new Uint8Array(size),
  owner: new Int16Array(size),
  size,
});

interface Stamp {
  readonly columns: number;
  readonly rows: number;
  readonly sampling: Sampling;
  readonly scale: Scale;
}

/**
 * Ink a bitmap into per-cell sample masks with its top-left sample at
 * (x0, y0). Unlit pixels mark a ghost on the cell under their centre, and
 * every cell the glyph covers records `id` as its owner.
 */
const stamp = (
  target: Stamp,
  bitmap: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  into: Uint8Array,
  extra: { ghost: Uint8Array; owner: Int16Array; id: number } | null
) => {
  const { columns, rows, sampling, scale } = target;
  const { gx, gy, bits } = sampling;
  for (let fy = 0; fy < GLYPH_HEIGHT; fy += 1) {
    for (let fx = 0; fx < width; fx += 1) {
      const lit = bitmap[fy * width + fx] === 1;
      const px = x0 + fx * scale.pw;
      const py = y0 + fy * scale.ph;
      for (let sy = py; sy < py + scale.ph; sy += 1) {
        const row = Math.floor(sy / gy);
        if (row < 0 || row >= rows) {
          continue;
        }
        for (let sx = px; sx < px + scale.pw; sx += 1) {
          const column = Math.floor(sx / gx);
          if (column < 0 || column >= columns) {
            continue;
          }
          const cell = row * columns + column;
          if (lit) {
            // Glyphs never overlap, so each sample is added once: a sum
            // of distinct bits is the mask.
            into[cell] =
              (into[cell] ?? 0) +
              (bits[(sy - row * gy) * gx + (sx - column * gx)] ?? 0);
          }
          if (extra) {
            extra.owner[cell] = extra.id;
          }
        }
      }
      if (!lit && extra) {
        const column = Math.floor((px + Math.floor(scale.pw / 2)) / gx);
        const row = Math.floor((py + Math.floor(scale.ph / 2)) / gy);
        if (column >= 0 && column < columns && row >= 0 && row < rows) {
          extra.ghost[row * columns + column] = 1;
        }
      }
    }
  }
};

// What a glyph slot showed before its last change, and when it changed.
interface SlotState {
  char: string;
  bitmap: Uint8Array;
  previous: Uint8Array;
  at: number;
}

/** Everything one frame's draw needs. */
interface Scene {
  readonly frame: MutableFrame;
  readonly rows: number;
  readonly plan: Plan;
  readonly sampling: Sampling;
  readonly buffers: Buffers;
  readonly slots: Map<string, SlotState>;
  /** Top cell row of the layout, centred in the grid. */
  readonly top: number;
  readonly time: number;
  /** Scramble length in milliseconds; 0 when motion is off. */
  readonly duration: number;
  readonly ink: Rgb8;
  readonly accent: Rgb8;
  readonly stops: readonly Rgb8[] | null;
  readonly ghost: boolean;
}

/**
 * Note a glyph slot's change. The first frame draws settled; a slot that
 * appears later (the done text) scrambles in from nothing.
 */
const touchSlot = (
  slots: Map<string, SlotState>,
  piece: Piece,
  time: number,
  first: boolean
): SlotState => {
  const slot = slots.get(piece.key);
  if (!slot) {
    const fresh = {
      at: first ? 0 : time,
      bitmap: piece.bitmap,
      char: piece.char,
      previous: first ? piece.bitmap : BLANK,
    };
    slots.set(piece.key, fresh);
    return fresh;
  }
  if (slot.char !== piece.char) {
    slot.previous = slot.bitmap;
    slot.bitmap = piece.bitmap;
    slot.char = piece.char;
    slot.at = time;
  }
  return slot;
};

/**
 * Stamp every glyph into the cell masks, and what it showed before into
 * `before` where it is still scrambling. Returns which pieces scramble.
 */
const stampPieces = (scene: Scene, columns: number): boolean[] => {
  const { frame, rows, plan, sampling, buffers, slots, time, duration } = scene;
  const { mask, before, ghost, owner } = buffers;
  mask.fill(0);
  before.fill(0);
  ghost.fill(0);
  owner.fill(-1);
  const grid: Stamp = {
    columns: frame.columns,
    rows,
    sampling,
    scale: plan.scale,
  };
  const { gx, gy } = sampling;
  const { pw } = plan.scale;
  const first = slots.size === 0;
  return plan.arrangement.pieces.map((piece, id) => {
    const lineWidth = plan.arrangement.widths[piece.line] ?? 0;
    // Centred, and started on a cell edge so pixels line up with cells.
    const offset = Math.floor((columns * gx - lineWidth * pw) / 2 / gx) * gx;
    const x0 = offset + piece.x * pw;
    const y0 = (scene.top + (plan.lineTops[piece.line] ?? 0)) * gy;
    const slot = touchSlot(slots, piece, time, first);
    const active = duration > 0 && time - slot.at < duration;
    stamp(grid, piece.bitmap, piece.width, x0, y0, mask, { ghost, id, owner });
    const shown = active ? slot.previous : piece.bitmap;
    stamp(grid, shown, piece.width, x0, y0, before, null);
    return active;
  });
};

/** A lit cell's colour: the piece's tone, or the ramp down the digit. */
const cellColor = (scene: Scene, piece: Piece, row: number): Rgb8 => {
  const { plan, stops } = scene;
  if (piece.tone === "accent" || piece.blink || !stops) {
    return piece.tone === "accent" ? scene.accent : scene.ink;
  }
  const lineTop = scene.top + (plan.lineTops[piece.line] ?? 0);
  const v = (row - lineTop + 0.5) / Math.max(1, plan.digitRows);
  // The bright end of the ramp: its dark stops vanish on dark paper.
  return sampleRamp(stops, 0.95 - 0.35 * v);
};

/** Turn the cell masks into glyphs: scrambling, inked or ghost. */
const paintCells = (scene: Scene, scrambling: boolean[], blink: number) => {
  const { frame, plan, sampling, buffers, slots, time, duration, ink } = scene;
  const { mask, before, ghost, owner } = buffers;
  const { pieces } = plan.arrangement;
  const step = Math.floor(time / SCRAMBLE_STEP);
  const { columns } = frame;
  for (let index = 0; index < buffers.size; index += 1) {
    const id = owner[index] ?? -1;
    const piece = pieces[id];
    if (!piece) {
      continue;
    }
    const x = index % columns;
    const y = Math.floor(index / columns);
    const cellMask = mask[index] ?? 0;
    const slot = slots.get(piece.key);
    const [r, g, b] = cellColor(scene, piece, y);
    // Each cell settles at its own moment within the scramble.
    const settles = slot
      ? slot.at + duration * (0.3 + 0.7 * hash01(index, slot.at % 100_000))
      : 0;
    if (scrambling[id] && cellMask !== before[index] && time < settles) {
      const { pool } = sampling;
      const glyph = pool[Math.floor(hash01(index, step) * pool.length)] ?? "#";
      frame.put(x, y, glyph, [r, g, b, 200]);
    } else if (cellMask) {
      frame.put(x, y, sampling.glyph(cellMask), [
        r,
        g,
        b,
        piece.blink ? blink : 255,
      ]);
    } else if (scene.ghost && ghost[index] && !piece.blink) {
      frame.put(x, y, sampling.ghost, [ink[0], ink[1], ink[2], GHOST_ALPHA]);
    }
  }
};

interface Box {
  readonly width: number;
  readonly font: string;
}

/** The container's width and font, re-read on resize and font loads. */
const useBox = (ref: RefObject<HTMLDivElement | null>): Box | null => {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) {
      return;
    }
    const measure = () => {
      const width = root.clientWidth;
      const font = readFont(root);
      setBox((previous) =>
        previous?.width === width && previous.font === font
          ? previous
          : { font, width }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    // A web font that loads late changes the cell width.
    const onFonts = () => setBox((previous) => previous && { ...previous });
    document.fonts?.addEventListener?.("loadingdone", onFonts);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", onFonts);
    };
  }, [ref]);
  return box;
};

/**
 * The time, on the client only, refreshed every `step` milliseconds in step
 * with the target and once more when it arrives. `null` on the server and
 * in the first render, so the markup hydrates without a mismatch.
 */
const useNow = (target: number | null, step: number): number | null => {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (target === null || time >= target) {
        return;
      }
      const left = target - time;
      const wait = left % step || step;
      // setTimeout overflows past about 24.8 days.
      timer = setTimeout(tick, Math.min(wait + 5, 2_000_000_000));
    };
    tick();
    return () => clearTimeout(timer);
  }, [target, step]);
  return now;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "long",
  timeStyle: "short",
};

const plural = (value: number, word: string) =>
  `${value} ${word}${value === 1 ? "" : "s"}`;

/** Remaining time to the minute, for screen readers. */
const describe = (remaining: number): string => {
  if (remaining < 60_000) {
    return "Less than a minute left";
  }
  const minutesLeft = Math.floor(remaining / 60_000);
  const days = Math.floor(minutesLeft / 1440);
  const hours = Math.floor(minutesLeft / 60) % 24;
  const minutes = minutesLeft % 60;
  const parts = [
    days > 0 ? plural(days, "day") : "",
    days > 0 || hours > 0 ? plural(hours, "hour") : "",
    plural(minutes, "minute"),
  ].filter(Boolean);
  return `${parts.join(", ")} left`;
};

export interface AsciiCountdownProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  /** The moment to count down to: a `Date`, an ISO string or epoch milliseconds. */
  to: Date | string | number;
  /** Labels under days, hours, minutes and seconds, or `false` for none. Default `["DAYS", "HRS", "MIN", "SEC"]`. */
  labels?: AsciiCountdownLabels | false;
  /** Drawn in the same big type once the countdown reaches zero. Default `"LIVE"`. */
  doneText?: string;
  /** Called once when the countdown reaches zero, or on mount if `to` has already passed. */
  onComplete?: () => void;
  /** Seconds a changed digit scrambles before it settles. 0 turns it off. Default 0.45. */
  scramble?: number;
  /** Drop the days group once fewer than 24 hours are left. Default `false`. */
  hideZeroDays?: boolean;
  /** Glyphs the digits are drawn with. `blocks` draws half blocks, `braille` a dot matrix, ramps their densest glyph. Default `"blocks"`. */
  charset?: CharsetName;
  /** A custom ramp from empty to dense, such as `" .oO@"`. Its densest glyph inks the digits. Wins over `charset`. */
  chars?: string;
  /** `mono` draws digits in ink and the accent; `duotone` shades the ink digits top to bottom along `ramp`. Default `"mono"`. */
  colorMode?: "mono" | "duotone";
  /** `duotone`: a ramp name or `#rrggbb` stops. Default `"sodium"`. */
  ramp?: RampName | readonly string[];
  /** The accent colour, a palette name, CSS variable name or any CSS colour. Default `"orange"`. */
  accent?: AsciiColor;
  /** Which parts take the accent. Default `"seconds"`. */
  accentOn?: AsciiCountdownAccent;
  /** Faint dots on the unlit pixels of each digit, like an LED board. Default `true`. */
  ghost?: boolean;
  /** Largest digit height in CSS pixels. The digits shrink to fit the width. Default 128. */
  size?: number;
  /** Glyph cell height in CSS pixels. Default: picked from 5 to 12 so the digits fill the width. */
  cell?: number;
  /** `false` holds still: no scramble or blinking, though the time still ticks. Default `true`. */
  animate?: boolean;
  /** Frame rate cap. Default 30. */
  fps?: number;
  /** Background behind the glyphs. Default `"transparent"`. */
  paper?: AsciiColor | "transparent";
  /** CRT effects, drawn as a CSS overlay. Default: none. */
  fx?: PostFx;
  /** Filled with a handle for export: the latest frame and the canvas. */
  handle?: RefObject<AsciiHandle | null>;
}

/**
 * A launch countdown in big glyph digits. Days, hours, minutes and seconds
 * are drawn from a 5x7 pixel font in half blocks, quadrants, Braille or
 * any ramp, sized to fit the container's width, with labels under each
 * group. Changed cells scramble for a beat and settle, colons blink
 * softly, and at zero it shows `doneText` and calls `onComplete`.
 */
// oxlint-disable-next-line complexity, max-statements -- each prop default counts as a branch.
export const AsciiCountdown = ({
  to,
  labels = DEFAULT_LABELS,
  doneText = "LIVE",
  onComplete,
  scramble = 0.45,
  hideZeroDays = false,
  charset = "blocks",
  chars,
  colorMode = "mono",
  ramp = "sodium",
  accent = "orange",
  accentOn = "seconds",
  ghost = true,
  size = 128,
  cell,
  animate = true,
  fps = 30,
  paper = "transparent",
  fx,
  handle,
  className,
  style,
  ...props
}: AsciiCountdownProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const target = toTime(to);
  const reducedMotion = usePrefersReducedMotion();
  const motion = animate && !reducedMotion;
  const inView = useInView(rootRef);
  const visible = useDocumentVisible();
  // Held still, the grid only repaints when React renders, so tick every
  // second while it can be seen. While it animates, or offscreen or in a
  // hidden tab, the minute is enough for the hidden text; minutes land in
  // step with the target, so completion stays exact and a resume repaints.
  const now = useNow(target, motion || !(inView && visible) ? 60_000 : 1000);
  const box = useBox(rootRef);
  const colors = useAsciiColors(rootRef, ["--ascii-ink", accent]);
  const sampling = samplingFor(charset, chars);
  const colonTone: Tone =
    accentOn === "colons" || accentOn === "both" ? "accent" : "ink";

  const remaining = target === null || now === null ? null : target - now;
  const done = remaining !== null && remaining <= 0;
  const parts = partsOf(remaining ?? 0);
  // `now` ticks on minutes in step with the target, so it is exact at the
  // moment the days run out. Days stay on until mounted.
  const showDays = !hideZeroDays || parts.days > 0 || remaining === null;

  // Fire once per target.
  const completeRef = useRef(onComplete);
  useEffect(() => {
    completeRef.current = onComplete;
  });
  const firedFor = useRef<number | null>(null);
  useEffect(() => {
    if (done && target !== null && firedFor.current !== target) {
      firedFor.current = target;
      completeRef.current?.();
    }
  }, [done, target]);

  const fit = box
    ? fitCountdown({
        cell,
        colonTone,
        font: box.font,
        groups: groupsOf(parts, labels, showDays, accentOn),
        sampling,
        showLabels: labels !== false,
        size,
        width: box.width,
      })
    : null;
  const plan = fit?.plan ?? null;

  const slotsRef = useRef(new Map<string, SlotState>());
  const buffersRef = useRef<Buffers>(makeBuffers(0));
  const stops = colorMode === "duotone" ? rampStops(ramp) : null;
  const ink = toBytes(colors?.[0], [128, 128, 128]);
  const accentRgb = toBytes(colors?.[1], [252, 180, 66]);

  const draw = ({ frame, metrics, rows }: AsciiGridDrawContext) => {
    if (target === null || !fit) {
      return;
    }
    const time = Date.now();
    const left = target - time;
    const finished = left <= 0;
    const columns = Math.min(frame.columns, fit.columns);
    // The layout comes from the last render; only the digits are live.
    const layout = finished
      ? planDone(doneText, fit.plan.rows, columns, metrics, sampling, size)
      : buildPlan(
          arrangeGroups(
            groupsOf(partsOf(left), labels, showDays, accentOn),
            fit.split,
            colonTone
          ),
          fit.plan.scale,
          sampling,
          fit.plan.labelRows
        );
    const cells = frame.columns * rows;
    if (buffersRef.current.size !== cells) {
      buffersRef.current = makeBuffers(cells);
    }
    const scene: Scene = {
      accent: accentRgb,
      buffers: buffersRef.current,
      duration: motion ? scramble * 1000 * (finished ? 2 : 1) : 0,
      frame,
      ghost,
      ink,
      plan: layout,
      rows,
      sampling,
      slots: slotsRef.current,
      stops,
      time,
      top: Math.max(0, Math.floor((rows - layout.rows) / 2)),
    };
    const scrambling = stampPieces(scene, columns);
    // Colons breathe with the seconds: bright on the tick, dim between.
    const phase = 1 - (((left % 1000) + 1000) % 1000) / 1000;
    const blink = motion
      ? Math.round(
          255 * (0.32 + 0.68 * (0.5 + 0.5 * Math.cos(phase * Math.PI * 2)))
        )
      : 255;
    paintCells(scene, scrambling, blink);
  };

  const height = fit ? fit.plan.rows * fit.metrics.height : undefined;

  // Only after mount: the server can't know the time left, and its
  // locale and time zone may not match the reader's.
  let spoken = "Countdown";
  let iso = "";
  if (target !== null && remaining !== null) {
    const when = new Date(target).toLocaleString(undefined, DATE_FORMAT);
    spoken = done ? doneText : `${describe(remaining)} until ${when}`;
    iso = new Date(target).toISOString();
  }

  return (
    <div
      ref={rootRef}
      data-state={done ? "done" : "counting"}
      className={cn("relative w-full", className)}
      style={{
        aspectRatio: height === undefined ? "7 / 1" : undefined,
        height,
        ...style,
      }}
      {...props}
    >
      <AsciiGrid
        draw={draw}
        cell={fit?.cell ?? cell}
        colored
        paper={paper}
        animate={motion}
        fps={fps}
        fx={fx}
        handle={handle}
        className="absolute inset-0"
      />
      {fit && plan && labels !== false && !done
        ? plan.arrangement.labels.map((label) => {
            const { gx } = sampling;
            const { pw } = plan.scale;
            const lineWidth = plan.arrangement.widths[label.line] ?? 0;
            // In cells, the same centring the draw uses.
            const offset = Math.floor(
              (fit.columns * gx - lineWidth * pw) / 2 / gx
            );
            const left = (offset + (label.x * pw) / gx) * fit.metrics.width;
            const width = ((label.width * pw) / gx) * fit.metrics.width;
            const topPx =
              ((plan.lineTops[label.line] ?? 0) + plan.digitRows) *
              fit.metrics.height;
            return (
              <span
                key={`${label.line}-${label.x}`}
                aria-hidden="true"
                className="pointer-events-none absolute flex justify-center overflow-hidden whitespace-nowrap text-[10px] leading-none tracking-[0.3em] opacity-55"
                style={{
                  color: cssColor("--ascii-ink"),
                  fontFamily: "var(--ascii-font)",
                  left,
                  paddingTop: 8,
                  top: topPx,
                  width,
                }}
              >
                {/* The tracking trails the last letter; this pulls it back to centre. */}
                <span style={{ marginRight: "-0.3em" }}>{label.text}</span>
              </span>
            );
          })
        : null}
      <span className="sr-only" role="timer">
        {spoken}
        {iso ? <time dateTime={iso} /> : null}
      </span>
    </div>
  );
};
