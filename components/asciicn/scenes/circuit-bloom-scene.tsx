"use client";

// Trace connections, chip parts and the seeded random are bit fields.
/* oxlint-disable no-bitwise */

import { useMemo, useRef } from "react";

import {
  ANSI16,
  AsciiGrid,
  BRAILLE_DOT_BITS,
  brailleChar,
  gradeRgb,
  hexToRgb,
  nearestIndex,
  PHOSPHORS,
  quadrantChar,
  RAMPS,
  rampChar,
  resolveCharset,
  sampleRamp,
  useAsciiColors,
} from "@/lib/ascii";
import type {
  AsciiGridDrawContext,
  AsciiSceneProps,
  Charset,
  PostFx,
  Rgb8,
} from "@/lib/ascii";

/** The solder mask the board is printed on, in truecolor. */
export type CircuitBoardColor = "green" | "navy";

export interface CircuitBloomSceneProps extends AsciiSceneProps {
  /** How fast traces grow, 0 to 3. Default 1. */
  growth?: number;
  /** How many chips share the board, 0.25 to 3 times the usual count. Default 1. */
  density?: number;
  /** How many electrons race along finished traces, 0 to 3. Default 1. */
  traffic?: number;
  /** Solder mask colour in truecolor: `"green"` or `"navy"`. Default `"green"`. */
  board?: CircuitBoardColor;
  /** Layout seed. The same seed on the same grid grows the same board. Default 7. */
  seed?: number;
}

// --- Palette ----------------------------------------------------------------

/** Colour families, each a ramp from dim to bright. Order matches FAMILY. */
interface BoardPalette {
  readonly backdrop: string;
  readonly mask: readonly string[];
  readonly glow: readonly string[];
  readonly copper: readonly string[];
  readonly pulse: readonly string[];
  readonly silk: readonly string[];
  readonly chip: readonly string[];
  readonly tin: readonly string[];
  readonly via: readonly string[];
}

const BOARDS = {
  green: {
    backdrop: "#03130b",
    chip: ["#0d1411", "#1f2a25", "#34423b"],
    copper: ["#3d220e", "#9a5524", "#e8913e", "#ffd9a0"],
    glow: ["#08302a", "#139a9a", "#6ff4ff"],
    mask: ["#062414", "#124a2a", "#25744a"],
    pulse: ["#19b8ff", "#86f2ff", "#ffffff"],
    silk: ["#3f5a4c", "#b9c9c0", "#ffffff"],
    tin: ["#4d5954", "#aab8b2", "#f2f7f5"],
    via: ["#5c3414", "#d88a3c", "#fff0c4"],
  },
  navy: {
    backdrop: "#040a1a",
    chip: ["#0c1020", "#1d2440", "#323b5e"],
    copper: ["#3a2a0c", "#94701f", "#e6b448", "#fff0b8"],
    glow: ["#0a2240", "#1584b8", "#78e8ff"],
    mask: ["#081436", "#14295c", "#26468a"],
    pulse: ["#2ab0ff", "#8ae6ff", "#ffffff"],
    silk: ["#46557a", "#c3cce4", "#ffffff"],
    tin: ["#535b70", "#b0b8cc", "#f4f6fb"],
    via: ["#5a4214", "#d8a440", "#fff2c8"],
  },
} as const satisfies Record<CircuitBoardColor, BoardPalette>;

const FAMILY_ORDER = [
  "mask",
  "glow",
  "copper",
  "pulse",
  "silk",
  "chip",
  "tin",
  "via",
] as const satisfies readonly (keyof BoardPalette)[];

const FAMILY = {
  chip: 5,
  copper: 2,
  glow: 1,
  mask: 0,
  pulse: 3,
  silk: 4,
  tin: 6,
  via: 7,
} as const satisfies Record<(typeof FAMILY_ORDER)[number], number>;

/** Brightness steps per colour family in the lookup table. */
const LEVELS = 32;

const DEFAULT_FX: PostFx = { bloom: 0.35, vignette: 0.2 };

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
        sampleRamp(stops, 0.18 + 0.82 * brightness(rgb) * level),
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
        mix(paper, ink, 0.12 + 0.88 * brightness(rgb) * level),
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
 * Every family at every brightness, already through the colour mode, so
 * the frame loop colours a cell with three reads and no allocation.
 */
const buildLut = (palette: BoardPalette, ink: SceneInk): Uint8ClampedArray => {
  const lut = new Uint8ClampedArray(FAMILY_ORDER.length * LEVELS * 3);
  for (const [family, name] of FAMILY_ORDER.entries()) {
    const stops = palette[name].map(hexToRgb);
    for (let level = 0; level < LEVELS; level += 1) {
      const rgb = ink.tint(sampleRamp(stops, level / (LEVELS - 1)));
      lut.set(rgb, (family * LEVELS + level) * 3);
    }
  }
  return lut;
};

// --- Glyphs ---------------------------------------------------------------------

// Directions clockwise from north, y down. A trace cell stores the
// directions it connects to as one bit each.
const DX = [0, 1, 1, 1, 0, -1, -1, -1] as const;
const DY = [-1, -1, 0, 1, 1, 1, 0, -1] as const;
const stepX = (dir: number) => DX[dir & 7] ?? 0;
const stepY = (dir: number) => DY[dir & 7] ?? 0;
const bit = (dir: number) => 1 << (dir & 7);
const rotate = (dir: number, by: number) => (dir + by + 8) & 7;
const isDiagonal = (dir: number) => (dir & 1) === 1;
/** A diagonal from (x, y) crosses the one from (x+dx, y) to (x, y+dy). */
const crossing = (dir: number) => (8 - dir) & 7;
/** The direction index for a unit step. */
const DIR_OF = [7, 0, 1, 6, -1, 2, 5, 4, 3] as const;
const dirOf = (dx: number, dy: number) => DIR_OF[(dy + 1) * 3 + dx + 1] ?? -1;

const ORTH_LIGHT = " │─└││┌├─┘─┴┐┤┬┼";
const ORTH_HEAVY = " ┃━┗┃┃┏┣━┛━┻┓┫┳╋";
const ORTH_ASCII = " |-+||++-+-+++++";

/** One glyph per connection mask: box drawing for runs, slashes for 45°. */
const traceGlyphs = (
  orth: string,
  rising: string,
  falling: string,
  cross: string
) =>
  Array.from({ length: 256 }, (_, mask) => {
    const index =
      (mask & 1) | ((mask >> 1) & 2) | ((mask >> 2) & 4) | ((mask >> 3) & 8);
    const count =
      (mask & 1) + ((mask >> 2) & 1) + ((mask >> 4) & 1) + ((mask >> 6) & 1);
    const up = (mask & (bit(1) | bit(5))) !== 0;
    const down = (mask & (bit(3) | bit(7))) !== 0;
    // A chamfer cell (one straight side, one diagonal) reads as the slash.
    if ((up || down) && count <= 1) {
      if (up && down) {
        return cross;
      }
      return up ? rising : falling;
    }
    return index === 0 ? "·" : (orth[index] ?? "+");
  });

interface GlyphSet {
  readonly trace: readonly string[];
  readonly hot: readonly string[];
  /** Chip parts by PART code. */
  readonly chip: readonly string[];
  readonly via: string;
  readonly viaHot: string;
  readonly pad: string;
  readonly padHot: string;
}

const UNICODE_GLYPHS: GlyphSet = {
  chip: [..."┏┓┗┛━┃┷┠┯┨ ●"],
  hot: traceGlyphs(ORTH_HEAVY, "╱", "╲", "╳"),
  pad: "□",
  padHot: "■",
  trace: traceGlyphs(ORTH_LIGHT, "╱", "╲", "╳"),
  via: "○",
  viaHot: "◉",
};

// `standard` is the plain-ASCII fallback: every glyph is 7-bit.
const ASCII_GLYPHS: GlyphSet = {
  chip: [..."++++=|++++ *"],
  hot: traceGlyphs(ORTH_ASCII.replaceAll("-", "="), "/", "\\", "X"),
  pad: "#",
  padHot: "@",
  trace: traceGlyphs(ORTH_ASCII, "/", "\\", "X"),
  via: "o",
  viaHot: "O",
};

const TEXTURE_STEPS = 16;

// Dot orders that thicken evenly, so a few dots read as a soft haze.
const BRAILLE_ORDER = [
  [1, 0],
  [3, 1],
  [0, 1],
  [2, 0],
  [2, 1],
  [0, 0],
  [3, 0],
  [1, 1],
] as const;
const QUADRANT_ORDER = [8, 1, 4, 2] as const;

/**
 * The background texture and glow halo as 16 glyphs from faint to strong,
 * taken from the charset so switching charsets changes the board's grain.
 */
const textureGlyphs = (set: Charset): readonly string[] =>
  Array.from({ length: TEXTURE_STEPS }, (_, step) => {
    const tone = step / (TEXTURE_STEPS - 1);
    switch (set.kind) {
      case "braille": {
        let mask = 0;
        const dots = Math.round(tone * 8);
        for (let i = 0; i < dots; i += 1) {
          const dot = BRAILLE_ORDER[i];
          if (dot) {
            mask += BRAILLE_DOT_BITS[dot[0]][dot[1]];
          }
        }
        return brailleChar(mask);
      }
      case "quadrants": {
        let mask = 0;
        const quads = Math.round(tone * 4);
        for (let i = 0; i < quads; i += 1) {
          mask += QUADRANT_ORDER[i] ?? 0;
        }
        return quadrantChar(mask);
      }
      case "edge": {
        if (step === 0) {
          return " ";
        }
        if (tone < 0.3) {
          return ".";
        }
        return tone < 0.6 ? "/" : "X";
      }
      case "ramp": {
        return rampChar(set, tone);
      }
      default: {
        const exhaustive: never = set.kind;
        return exhaustive;
      }
    }
  });

// --- The board ------------------------------------------------------------------

const KIND = { chip: 4, empty: 0, pad: 3, text: 5, trace: 1, via: 2 } as const;
const PART = {
  bl: 2,
  body: 10,
  br: 3,
  dot: 11,
  h: 4,
  pinE: 7,
  pinN: 6,
  pinS: 8,
  pinW: 9,
  tl: 0,
  tr: 1,
  v: 5,
} as const;
const STATE = { done: 2, dying: 3, free: 0, growing: 1 } as const;
const CHIP_STATE = { free: 0, live: 1, retiring: 2 } as const;

const MAX_TRACES = 256;
const MAX_LEN = 96;
const MAX_CHIPS = 32;
const MAX_PINS = 640;
const MAX_PULSES = 160;
const TAIL = 6;
const STEP = 1 / 30;

const PARTS = [
  "MCU",
  "DSP",
  "RAM",
  "ROM",
  "ADC",
  "DAC",
  "PHY",
  "PLL",
  "FPGA",
  "NPU",
  "LDO",
  "RF",
  "USB",
  "CAN",
  "SoC",
  "SRAM",
] as const;
const MARKS = [
  "GND",
  "+3V3",
  "+5V",
  "TP1",
  "TP4",
  "R12",
  "C7",
  "J2",
  "SW1",
  "L3",
  "D5",
  "Y1",
  "CLK",
  "VBUS",
  "RST",
] as const;

/**
 * Everything on the board, in flat typed arrays allocated once per grid
 * size. Cells hold what is printed there; traces, chips, pins and pulses
 * are fixed pools indexed by slot.
 */
interface Board {
  readonly key: string;
  readonly columns: number;
  readonly rows: number;
  /** Cell width over height, to measure distances in true proportions. */
  readonly aspect: number;
  readonly chipTarget: number;
  readonly maxLen: number;
  readonly kind: Uint8Array;
  /** Trace cells: connection bits. Chip cells: the PART code. */
  readonly mask: Uint8Array;
  /** The trace or chip a cell belongs to, or -1. */
  readonly owner: Int16Array;
  readonly text: string[];
  /** The printed grain of the solder mask, 0 to ~0.2. */
  readonly base: Float32Array;
  /** Light added this frame; diffused into `glow`. */
  readonly heat: Float32Array;
  readonly glow: Float32Array;
  /** Pulse light on trace cells this frame. */
  readonly flash: Float32Array;
  readonly tState: Uint8Array;
  readonly tLen: Uint16Array;
  readonly tCells: Int32Array;
  readonly tDir: Uint8Array;
  /** While chamfering, which way the 90° turn finishes; else 0. */
  readonly tTurn: Int8Array;
  readonly tRun: Int16Array;
  readonly tMax: Uint16Array;
  readonly tParent: Int16Array;
  readonly tChildren: Uint8Array;
  readonly tChip: Int16Array;
  readonly tPin: Int16Array;
  /** Branches: the parent cell they leave from, and in which direction. */
  readonly tRoot: Int32Array;
  readonly tRootDir: Uint8Array;
  readonly tAttract: Uint8Array;
  readonly tEnd: Uint8Array;
  readonly tDoneAt: Float32Array;
  readonly tLife: Float32Array;
  readonly tBoost: Float32Array;
  readonly tBright: Float32Array;
  readonly cState: Uint8Array;
  readonly cX: Int16Array;
  readonly cY: Int16Array;
  readonly cW: Int16Array;
  readonly cH: Int16Array;
  readonly cPower: Float32Array;
  readonly cBorn: Float32Array;
  readonly pCell: Int32Array;
  readonly pDir: Uint8Array;
  readonly pChip: Int16Array;
  readonly pTrace: Int16Array;
  readonly eTrace: Int16Array;
  readonly ePos: Float32Array;
  readonly eSpeed: Float32Array;
  rng: number;
  time: number;
  carry: number;
  nextPower: number;
  nextRetire: number;
  serial: number;
  ticks: number;
  wasDown: boolean;
  readonly hand: Hand;
}

/** mulberry32: small, fast and seedable, so a seed always grows one board. */
const random = (board: Board): number => {
  // oxlint-disable-next-line unicorn/prefer-math-trunc -- 32-bit wraparound is the algorithm.
  board.rng = (board.rng + 1_831_565_813) | 0;
  let t = board.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  // oxlint-disable-next-line unicorn/prefer-math-trunc -- reads the bits as unsigned.
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
};

const randomInt = (board: Board, min: number, max: number) =>
  min + Math.floor(random(board) * (max - min + 1));

const createBoard = (
  columns: number,
  rows: number,
  aspect: number,
  density: number,
  seed: number,
  key: string
): Board => {
  const size = columns * rows;
  const board: Board = {
    aspect,
    base: new Float32Array(size),
    cBorn: new Float32Array(MAX_CHIPS),
    cH: new Int16Array(MAX_CHIPS),
    cPower: new Float32Array(MAX_CHIPS),
    cState: new Uint8Array(MAX_CHIPS),
    cW: new Int16Array(MAX_CHIPS),
    cX: new Int16Array(MAX_CHIPS),
    cY: new Int16Array(MAX_CHIPS),
    carry: 0,
    chipTarget: Math.max(
      3,
      Math.min(MAX_CHIPS - 8, Math.round((size / 900) * density))
    ),
    columns,
    ePos: new Float32Array(MAX_PULSES),
    eSpeed: new Float32Array(MAX_PULSES),
    eTrace: new Int16Array(MAX_PULSES).fill(-1),
    flash: new Float32Array(size),
    glow: new Float32Array(size),
    hand: { active: false, pressed: false, x: -1, y: -1 },
    heat: new Float32Array(size),
    key,
    kind: new Uint8Array(size),
    mask: new Uint8Array(size),
    maxLen: Math.min(MAX_LEN, Math.max(14, Math.round(columns * 0.5))),
    nextPower: 1,
    nextRetire: 20,
    owner: new Int16Array(size).fill(-1),
    pCell: new Int32Array(MAX_PINS),
    pChip: new Int16Array(MAX_PINS).fill(-1),
    pDir: new Uint8Array(MAX_PINS),
    pTrace: new Int16Array(MAX_PINS).fill(-1),
    rng: Math.imul(Math.trunc(seed), 2_654_435_761) ^ 2_654_435_769,
    rows,
    serial: 1,
    tAttract: new Uint8Array(MAX_TRACES),
    tBoost: new Float32Array(MAX_TRACES),
    tBright: new Float32Array(MAX_TRACES),
    tCells: new Int32Array(MAX_TRACES * MAX_LEN),
    tChildren: new Uint8Array(MAX_TRACES),
    tChip: new Int16Array(MAX_TRACES).fill(-1),
    tDir: new Uint8Array(MAX_TRACES),
    tDoneAt: new Float32Array(MAX_TRACES),
    tEnd: new Uint8Array(MAX_TRACES),
    tLen: new Uint16Array(MAX_TRACES),
    tLife: new Float32Array(MAX_TRACES),
    tMax: new Uint16Array(MAX_TRACES),
    tParent: new Int16Array(MAX_TRACES).fill(-1),
    tPin: new Int16Array(MAX_TRACES).fill(-1),
    tRoot: new Int32Array(MAX_TRACES).fill(-1),
    tRootDir: new Uint8Array(MAX_TRACES),
    tRun: new Int16Array(MAX_TRACES),
    tState: new Uint8Array(MAX_TRACES),
    tTurn: new Int8Array(MAX_TRACES),
    text: Array.from({ length: size }, () => " "),
    ticks: 0,
    time: 0,
    wasDown: false,
  };
  // A dot lattice like a ground pour seen through the mask, with a few
  // specks of grain between.
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const lattice = x % 4 === 2 && y % 2 === 1;
      const speck = random(board) < 0.025;
      if (lattice) {
        board.base[y * columns + x] = 0.14;
      } else if (speck) {
        board.base[y * columns + x] = 0.08;
      }
    }
  }
  return board;
};

// --- Chips ----------------------------------------------------------------------

const inside = (board: Board, x: number, y: number) =>
  x >= 1 && y >= 1 && x < board.columns - 1 && y < board.rows - 1;

/** Whether a chip fits with room around it for its pins' traces. */
const fits = (board: Board, x: number, y: number, w: number, h: number) => {
  for (let cy = y - 1; cy <= y + h; cy += 1) {
    for (let cx = x - 2; cx <= x + w + 1; cx += 1) {
      if (!inside(board, cx, cy)) {
        return false;
      }
      if (read(board.kind, cy * board.columns + cx) !== KIND.empty) {
        return false;
      }
    }
  }
  return true;
};

const setCell = (
  board: Board,
  x: number,
  y: number,
  kind: number,
  code: number,
  owner: number,
  glyph = " "
) => {
  const index = y * board.columns + x;
  board.kind[index] = kind;
  board.mask[index] = code;
  board.owner[index] = owner;
  board.text[index] = glyph;
};

const writeText = (
  board: Board,
  x: number,
  y: number,
  text: string,
  owner: number
) => {
  for (let i = 0; i < text.length; i += 1) {
    setCell(board, x + i, y, KIND.text, 0, owner, text[i]);
  }
};

const addPin = (
  board: Board,
  chip: number,
  x: number,
  y: number,
  dir: number
) => {
  for (let pin = 0; pin < MAX_PINS; pin += 1) {
    if (read(board.pChip, pin) === -1) {
      board.pChip[pin] = chip;
      board.pCell[pin] = y * board.columns + x;
      board.pDir[pin] = dir;
      board.pTrace[pin] = -1;
      return;
    }
  }
};

/** Print a chip package: heavy outline, pins on every side, silkscreen label. */
const placeChip = (
  board: Board,
  x: number,
  y: number,
  w: number,
  h: number
): number => {
  let chip = -1;
  for (let slot = 0; slot < MAX_CHIPS; slot += 1) {
    if (read(board.cState, slot) === CHIP_STATE.free) {
      chip = slot;
      break;
    }
  }
  if (chip < 0) {
    return -1;
  }
  board.cState[chip] = CHIP_STATE.live;
  board.cX[chip] = x;
  board.cY[chip] = y;
  board.cW[chip] = w;
  board.cH[chip] = h;
  board.cPower[chip] = 1;
  board.cBorn[chip] = board.time;
  const right = x + w - 1;
  const bottom = y + h - 1;
  for (let cy = y; cy <= bottom; cy += 1) {
    for (let cx = x; cx <= right; cx += 1) {
      let part: number = PART.body;
      if (cy === y || cy === bottom) {
        part = PART.h;
      } else if (cx === x || cx === right) {
        part = PART.v;
      }
      setCell(board, cx, cy, KIND.chip, part, chip);
    }
  }
  setCell(board, x, y, KIND.chip, PART.tl, chip);
  setCell(board, right, y, KIND.chip, PART.tr, chip);
  setCell(board, x, bottom, KIND.chip, PART.bl, chip);
  setCell(board, right, bottom, KIND.chip, PART.br, chip);
  for (let cx = x + 2; cx <= right - 2; cx += 2) {
    setCell(board, cx, y, KIND.chip, PART.pinN, chip);
    addPin(board, chip, cx, y, 0);
    setCell(board, cx, bottom, KIND.chip, PART.pinS, chip);
    addPin(board, chip, cx, bottom, 4);
  }
  const sideStep = h > 4 ? 2 : 1;
  for (let cy = y + 1; cy <= bottom - 1; cy += sideStep) {
    setCell(board, x, cy, KIND.chip, PART.pinW, chip);
    addPin(board, chip, x, cy, 6);
    setCell(board, right, cy, KIND.chip, PART.pinE, chip);
    addPin(board, chip, right, cy, 2);
  }
  const inner = w - 2;
  const designator = `U${board.serial}`;
  const part = PARTS[randomInt(board, 0, PARTS.length - 1)] ?? "MCU";
  board.serial += 1;
  if (h >= 4) {
    setCell(board, x + 1, y + 1, KIND.chip, PART.dot, chip);
    const middle = y + Math.floor((h - 2) / 2);
    writeText(
      board,
      x + 1 + Math.floor((inner - designator.length) / 2),
      middle,
      designator,
      chip
    );
    if (part.length <= inner) {
      writeText(
        board,
        x + 1 + Math.floor((inner - part.length) / 2),
        middle + 1,
        part,
        chip
      );
    }
  } else {
    const both = `${designator} ${part}`;
    const label = both.length <= inner ? both : designator;
    writeText(
      board,
      x + 1 + Math.floor((inner - label.length) / 2),
      y + 1,
      label.slice(0, inner),
      chip
    );
  }
  return chip;
};

const chipSize = (board: Board): [number, number] => {
  const narrow = board.columns < 70;
  const w = narrow ? randomInt(board, 7, 10) : randomInt(board, 8, 14);
  const h = randomInt(board, 3, narrow ? 4 : 5);
  return [w, h];
};

/** A chip somewhere free, or -1 after a few misses. */
const scatterChip = (board: Board): number => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const [w, h] = chipSize(board);
    const x = randomInt(board, 3, Math.max(3, board.columns - w - 3));
    const y = randomInt(board, 2, Math.max(2, board.rows - h - 2));
    if (fits(board, x, y, w, h)) {
      return placeChip(board, x, y, w, h);
    }
  }
  return -1;
};

const clearChip = (board: Board, chip: number) => {
  const x = read(board.cX, chip);
  const y = read(board.cY, chip);
  for (let cy = y; cy < y + read(board.cH, chip); cy += 1) {
    for (let cx = x; cx < x + read(board.cW, chip); cx += 1) {
      setCell(board, cx, cy, KIND.empty, 0, -1);
    }
  }
  for (let pin = 0; pin < MAX_PINS; pin += 1) {
    if (read(board.pChip, pin) === chip) {
      board.pChip[pin] = -1;
    }
  }
  board.cState[chip] = CHIP_STATE.free;
};

/** Small silkscreen marks between the parts: test points, rails, refs. */
const printMarks = (board: Board) => {
  const count = Math.max(2, Math.min(9, Math.round(board.kind.length / 1400)));
  for (let mark = 0; mark < count; mark += 1) {
    const text = MARKS[randomInt(board, 0, MARKS.length - 1)] ?? "GND";
    const x = randomInt(board, 2, Math.max(2, board.columns - text.length - 3));
    const y = randomInt(board, 1, Math.max(1, board.rows - 2));
    let free = true;
    for (let cx = x - 1; cx <= x + text.length && free; cx += 1) {
      free =
        inside(board, cx, y) &&
        read(board.kind, y * board.columns + cx) === KIND.empty;
    }
    if (free) {
      writeText(board, x, y, text, -1);
    }
  }
};

// --- Traces ---------------------------------------------------------------------

const freeTrace = (board: Board): number => {
  for (let trace = 0; trace < MAX_TRACES; trace += 1) {
    if (read(board.tState, trace) === STATE.free) {
      return trace;
    }
  }
  return -1;
};

const startTrace = (
  board: Board,
  first: number,
  dir: number,
  chip: number,
  attract: boolean
): number => {
  const trace = freeTrace(board);
  if (trace < 0) {
    return -1;
  }
  board.tState[trace] = STATE.growing;
  board.tLen[trace] = 1;
  board.tCells[trace * MAX_LEN] = first;
  board.kind[first] = KIND.trace;
  board.mask[first] = bit(rotate(dir, 4));
  board.owner[first] = trace;
  board.tDir[trace] = dir;
  board.tTurn[trace] = 0;
  board.tRun[trace] = attract ? 1 : randomInt(board, 2, 7);
  board.tMax[trace] = randomInt(board, 12, board.maxLen);
  board.tParent[trace] = -1;
  board.tChildren[trace] = 0;
  board.tChip[trace] = chip;
  board.tPin[trace] = -1;
  board.tRoot[trace] = -1;
  board.tAttract[trace] = attract ? 1 : 0;
  board.tEnd[trace] = random(board) < 0.7 ? KIND.via : KIND.pad;
  board.tBoost[trace] = attract ? 1 : 0;
  return trace;
};

const sproutFromPin = (board: Board, pin: number, attract: boolean): number => {
  const dir = read(board.pDir, pin);
  const cell = read(board.pCell, pin);
  const x = (cell % board.columns) + stepX(dir);
  const y = Math.floor(cell / board.columns) + stepY(dir);
  const first = y * board.columns + x;
  if (!inside(board, x, y) || read(board.kind, first) !== KIND.empty) {
    return -1;
  }
  const trace = startTrace(board, first, dir, read(board.pChip, pin), attract);
  if (trace >= 0) {
    board.tPin[trace] = pin;
    board.pTrace[pin] = trace;
  }
  return trace;
};

/** Whether a trace cell is a straight run, so a branch can tee off it. */
const isStraight = (mask: number) =>
  mask === 0b0001_0001 || mask === 0b0100_0100;

const sproutBranch = (
  board: Board,
  parent: number,
  junction: number,
  dir: number,
  attract: boolean
): number => {
  const mask = read(board.mask, junction);
  if (!isStraight(mask) || (mask & bit(dir)) !== 0 || isDiagonal(dir)) {
    return -1;
  }
  if (read(board.tChildren, parent) >= 250) {
    return -1;
  }
  const x = (junction % board.columns) + stepX(dir);
  const y = Math.floor(junction / board.columns) + stepY(dir);
  const first = y * board.columns + x;
  if (!inside(board, x, y) || read(board.kind, first) !== KIND.empty) {
    return -1;
  }
  const trace = startTrace(
    board,
    first,
    dir,
    read(board.tChip, parent),
    attract
  );
  if (trace < 0) {
    return -1;
  }
  board.mask[junction] = mask + bit(dir);
  board.tParent[trace] = parent;
  board.tRoot[trace] = junction;
  board.tRootDir[trace] = dir;
  board.tChildren[parent] = read(board.tChildren, parent) + 1;
  board.tMax[trace] = randomInt(board, 6, Math.max(8, board.maxLen >> 1));
  return trace;
};

/** Undo a trace's link to its pin or its parent's junction. */
const detach = (board: Board, trace: number) => {
  const pin = read(board.tPin, trace);
  if (pin >= 0 && read(board.pTrace, pin) === trace) {
    board.pTrace[pin] = -1;
  }
  const parent = read(board.tParent, trace);
  const root = read(board.tRoot, trace);
  if (parent >= 0 && root >= 0) {
    board.mask[root] =
      read(board.mask, root) & ~bit(read(board.tRootDir, trace));
    board.tChildren[parent] = Math.max(0, read(board.tChildren, parent) - 1);
  }
  board.tState[trace] = STATE.free;
  board.tPin[trace] = -1;
  board.tParent[trace] = -1;
  board.tRoot[trace] = -1;
};

/** Remove a trace and its branches at once (a dropped chip clears space). */
const removeTrace = (board: Board, trace: number) => {
  for (let child = 0; child < MAX_TRACES; child += 1) {
    if (
      read(board.tState, child) !== STATE.free &&
      read(board.tParent, child) === trace
    ) {
      removeTrace(board, child);
    }
  }
  const base = trace * MAX_LEN;
  for (let i = 0; i < read(board.tLen, trace); i += 1) {
    const cell = read(board.tCells, base + i);
    board.kind[cell] = KIND.empty;
    board.mask[cell] = 0;
    board.owner[cell] = -1;
  }
  board.tLen[trace] = 0;
  detach(board, trace);
};

/** Start a trace and its branches retracting. */
const killTrace = (board: Board, trace: number) => {
  const state = read(board.tState, trace);
  if (state === STATE.free || state === STATE.dying) {
    return;
  }
  board.tState[trace] = STATE.dying;
  for (let child = 0; child < MAX_TRACES; child += 1) {
    if (
      read(board.tState, child) !== STATE.free &&
      read(board.tParent, child) === trace
    ) {
      killTrace(board, child);
    }
  }
};

/** Pull the tip back one cell; the last cell detaches the trace. */
const retract = (board: Board, trace: number) => {
  const base = trace * MAX_LEN;
  const len = read(board.tLen, trace);
  const last = read(board.tCells, base + len - 1);
  board.kind[last] = KIND.empty;
  board.mask[last] = 0;
  board.owner[last] = -1;
  if (len > 1) {
    const before = read(board.tCells, base + len - 2);
    const { columns } = board;
    const dir = dirOf(
      (last % columns) - (before % columns),
      Math.floor(last / columns) - Math.floor(before / columns)
    );
    if (dir >= 0) {
      board.mask[before] = read(board.mask, before) & ~bit(dir);
    }
  }
  board.tLen[trace] = len - 1;
  if (len <= 1) {
    detach(board, trace);
  }
};

const finishTrace = (board: Board, trace: number) => {
  const len = read(board.tLen, trace);
  if (len < 4) {
    removeTrace(board, trace);
    return;
  }
  const last = read(board.tCells, trace * MAX_LEN + len - 1);
  board.kind[last] = read(board.tEnd, trace);
  board.tState[trace] = STATE.done;
  board.tDoneAt[trace] = board.time;
  board.tLife[trace] = 12 + random(board) * 26;
  board.tAttract[trace] = 0;
};

/** Trace cells around a cell, not counting the two it grows from. */
const crowding = (board: Board, cell: number, head: number, before: number) => {
  const { columns, kind } = board;
  const x = cell % columns;
  const y = Math.floor(cell / columns);
  let count = 0;
  for (let dir = 0; dir < 8; dir += 1) {
    const nx = x + stepX(dir);
    const ny = y + stepY(dir);
    if (nx < 0 || ny < 0 || nx >= columns || ny >= board.rows) {
      continue;
    }
    const near = ny * columns + nx;
    const k = read(kind, near);
    if (
      near !== head &&
      near !== before &&
      (k === KIND.trace || k === KIND.via || k === KIND.pad)
    ) {
      count += 1;
    }
  }
  return count;
};

/** The step of the eight that heads most directly at a point. */
const aimAt = (
  board: Board,
  fromX: number,
  fromY: number,
  x: number,
  y: number
) => {
  const tx = (x - fromX) * board.aspect;
  const ty = y - fromY;
  let best = 0;
  let bestDot = -2;
  for (let dir = 0; dir < 8; dir += 1) {
    const sx = stepX(dir) * board.aspect;
    const sy = stepY(dir);
    const dot = (sx * tx + sy * ty) / Math.hypot(sx, sy);
    if (dot > bestDot) {
      bestDot = dot;
      best = dir;
    }
  }
  return best;
};

/** Signed 45° steps from one direction to another, -4 to 3. */
const turnBetween = (from: number, to: number) => ((to - from + 12) % 8) - 4;

const coin = (board: Board) => (random(board) < 0.5 ? 1 : -1);

/** Scratch for one growth step, reused so growing allocates nothing. */
const heading = { cell: -1, run: 0, turn: 0, want: 0 };
const CANDIDATES = new Int8Array(5);

/**
 * Where a run wants to go next. Runs go straight, then turn through a 45°
 * chamfer or a hard corner; a run reaching for the pointer bends toward it
 * one 45° step at a time.
 */
const steer = (
  board: Board,
  trace: number,
  hx: number,
  hy: number,
  pointerX: number,
  pointerY: number
) => {
  const dir = read(board.tDir, trace);
  heading.run = read(board.tRun, trace) - 1;
  heading.turn = read(board.tTurn, trace);
  heading.want = dir;
  if (read(board.tAttract, trace) === 1 && pointerX >= 0) {
    const delta = turnBetween(dir, aimAt(board, hx, hy, pointerX, pointerY));
    if (delta !== 0 && (heading.run <= 0 || Math.abs(delta) >= 2)) {
      heading.want = rotate(dir, Math.sign(delta));
      heading.run = 2;
    }
    heading.turn = 0;
    return;
  }
  if (heading.run > 0) {
    return;
  }
  if (isDiagonal(dir)) {
    // Finish the chamfer back onto a straight run.
    heading.want = rotate(dir, heading.turn === 0 ? coin(board) : heading.turn);
    heading.turn = 0;
    heading.run = randomInt(board, 4, 14);
    return;
  }
  const roll = random(board);
  const sense = coin(board);
  // Chamfers stay one or two cells: slash glyphs only meet at the corners
  // of their cells, so long diagonals read as loose strokes.
  if (roll < 0.3) {
    heading.want = rotate(dir, sense);
    heading.turn = sense;
    heading.run = randomInt(board, 1, 2);
  } else if (roll < 0.85) {
    heading.want = rotate(dir, sense * 2);
    heading.run = randomInt(board, 4, 14);
  } else {
    heading.run = randomInt(board, 3, 10);
  }
};

/** Whether a step lands on free board without crossing another diagonal. */
const open = (board: Board, hx: number, hy: number, step: number) => {
  const nx = hx + stepX(step);
  const ny = hy + stepY(step);
  if (!inside(board, nx, ny)) {
    return false;
  }
  if (read(board.kind, ny * board.columns + nx) !== KIND.empty) {
    return false;
  }
  return (
    !isDiagonal(step) ||
    (read(board.mask, hy * board.columns + nx) & bit(crossing(step))) === 0
  );
};

/**
 * The best open step: the wanted one first, then gentler and harder
 * alternatives, each marked down for copper it would crowd. Sets
 * `heading.cell`; returns -1 when boxed in.
 */
const pickStep = (
  board: Board,
  head: number,
  before: number,
  dir: number
): number => {
  const hx = head % board.columns;
  const hy = Math.floor(head / board.columns);
  const side = coin(board);
  CANDIDATES[0] = heading.want;
  CANDIDATES[1] = dir;
  CANDIDATES[2] = rotate(heading.want, side);
  CANDIDATES[3] = rotate(heading.want, -side);
  CANDIDATES[4] = rotate(dir, side * 2);
  let best = -1;
  let bestScore = 7;
  for (let i = 0; i < CANDIDATES.length; i += 1) {
    const step = read(CANDIDATES, i);
    // A diagonal only bends 45° at a time; a 90° bend would draw an X.
    const limit = isDiagonal(dir) ? 1 : 2;
    if (
      Math.abs(turnBetween(dir, step)) <= limit &&
      open(board, hx, hy, step)
    ) {
      const cell = (hy + stepY(step)) * board.columns + hx + stepX(step);
      const score = i + 3 * crowding(board, cell, head, before);
      if (score < bestScore) {
        bestScore = score;
        best = step;
        heading.cell = cell;
      }
    }
  }
  return best;
};

/**
 * Grow one cell, steering away from other copper. A trace that runs out
 * of room or length, or reaches the pointer, ends in a via or a pad.
 */
const growTrace = (
  board: Board,
  trace: number,
  pointerX: number,
  pointerY: number
) => {
  const { columns } = board;
  const base = trace * MAX_LEN;
  const len = read(board.tLen, trace);
  const head = read(board.tCells, base + len - 1);
  const before = len > 1 ? read(board.tCells, base + len - 2) : -1;
  const hx = head % columns;
  const hy = Math.floor(head / columns);
  const dir = read(board.tDir, trace);
  const attract = read(board.tAttract, trace) === 1 && pointerX >= 0;
  if (
    attract &&
    Math.hypot((pointerX - hx) * board.aspect, pointerY - hy) < 1.2
  ) {
    finishTrace(board, trace);
    return;
  }
  steer(board, trace, hx, hy, pointerX, pointerY);
  const best = pickStep(board, head, before, dir);
  if (best < 0) {
    finishTrace(board, trace);
    return;
  }

  const { cell } = heading;
  board.mask[head] = read(board.mask, head) | bit(best);
  board.kind[cell] = KIND.trace;
  board.mask[cell] = bit(rotate(best, 4));
  board.owner[cell] = trace;
  board.tCells[base + len] = cell;
  board.tLen[trace] = len + 1;
  board.tDir[trace] = best;
  if (best !== heading.want) {
    heading.turn = 0;
    heading.run = isDiagonal(best) ? 1 : randomInt(board, 2, 6);
  }
  board.tTurn[trace] = heading.turn;
  board.tRun[trace] = heading.run;

  // Tee a branch off the straight cell just behind the new head.
  if (!attract && len >= 4 && !isDiagonal(best) && random(board) < 0.045) {
    sproutBranch(board, trace, head, rotate(best, coin(board) * 2), false);
  }
  if (len + 1 >= read(board.tMax, trace) || len + 1 >= MAX_LEN) {
    finishTrace(board, trace);
  }
};

// --- Pulses ---------------------------------------------------------------------

const firePulse = (board: Board, trace: number) => {
  for (let pulse = 0; pulse < MAX_PULSES; pulse += 1) {
    if (read(board.eTrace, pulse) === -1) {
      const outward = random(board) < 0.82;
      const speed = 14 + random(board) * 22;
      board.eTrace[pulse] = trace;
      board.ePos[pulse] = outward ? 0 : read(board.tLen, trace) - 1;
      board.eSpeed[pulse] = outward ? speed : -speed;
      return;
    }
  }
};

const movePulses = (board: Board, dt: number) => {
  for (let pulse = 0; pulse < MAX_PULSES; pulse += 1) {
    const trace = read(board.eTrace, pulse);
    if (trace < 0) {
      continue;
    }
    const len = read(board.tLen, trace);
    const pos = read(board.ePos, pulse) + read(board.eSpeed, pulse) * dt;
    if (read(board.tState, trace) !== STATE.done) {
      board.eTrace[pulse] = -1;
    } else if (pos >= len || pos < 0) {
      // Arrival: the via or pin it reached flares.
      const end = read(board.tCells, trace * MAX_LEN + (pos < 0 ? 0 : len - 1));
      board.heat[end] = read(board.heat, end) + 1.6;
      board.eTrace[pulse] = -1;
    } else {
      board.ePos[pulse] = pos;
    }
  }
};

const paintPulses = (board: Board) => {
  const { flash, heat, tCells } = board;
  for (let pulse = 0; pulse < MAX_PULSES; pulse += 1) {
    const trace = read(board.eTrace, pulse);
    if (trace < 0) {
      continue;
    }
    const len = read(board.tLen, trace);
    const pos = read(board.ePos, pulse);
    const back = read(board.eSpeed, pulse) > 0 ? -1 : 1;
    const head = Math.floor(pos);
    for (let k = 0; k < TAIL; k += 1) {
      const at = head + back * k;
      if (at < 0 || at >= len) {
        break;
      }
      const cell = read(tCells, trace * MAX_LEN + at);
      const fade = 1 - k / TAIL;
      const light = fade * fade;
      if (light > read(flash, cell)) {
        flash[cell] = light;
      }
      if (k === 0) {
        heat[cell] = read(heat, cell) + 0.7;
      }
    }
  }
};

// --- Simulation -------------------------------------------------------------

interface Knobs {
  readonly growth: number;
  readonly traffic: number;
}

/** The pointer this frame, in cells. Reused, so input allocates nothing. */
interface Hand {
  x: number;
  y: number;
  active: boolean;
  pressed: boolean;
}

const NO_HAND: Readonly<Hand> = { active: false, pressed: false, x: -1, y: -1 };

const liveChips = (board: Board) => {
  let count = 0;
  for (let chip = 0; chip < MAX_CHIPS; chip += 1) {
    if (read(board.cState, chip) === CHIP_STATE.live) {
      count += 1;
    }
  }
  return count;
};

/** A random pin with nothing attached, on a chip that is staying. */
const freePin = (board: Board): number => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const pin = randomInt(board, 0, MAX_PINS - 1);
    const chip = read(board.pChip, pin);
    if (
      chip >= 0 &&
      read(board.pTrace, pin) === -1 &&
      read(board.cState, chip) === CHIP_STATE.live
    ) {
      return pin;
    }
  }
  return -1;
};

const distance = (board: Board, cell: number, x: number, y: number) =>
  Math.hypot(
    ((cell % board.columns) - x) * board.aspect,
    Math.floor(cell / board.columns) - y
  );

/** Power the free pin nearest the pointer and grow a trace toward it. */
const reachFromPin = (board: Board, hand: Readonly<Hand>) => {
  let best = -1;
  let bestDistance = 16;
  for (let pin = 0; pin < MAX_PINS; pin += 1) {
    const chip = read(board.pChip, pin);
    if (
      chip < 0 ||
      read(board.pTrace, pin) !== -1 ||
      read(board.cState, chip) !== CHIP_STATE.live
    ) {
      continue;
    }
    const d = distance(board, read(board.pCell, pin), hand.x, hand.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = pin;
    }
  }
  if (best >= 0) {
    sproutFromPin(board, best, true);
  }
};

/** Tee a new branch off the finished trace nearest the pointer, toward it. */
const reachFromTrace = (board: Board, hand: Readonly<Hand>) => {
  let bestTrace = -1;
  let bestCell = -1;
  let bestDistance = 14;
  for (let trace = 0; trace < MAX_TRACES; trace += 1) {
    if (read(board.tState, trace) !== STATE.done) {
      continue;
    }
    const len = read(board.tLen, trace);
    for (let i = 1; i < len - 1; i += 1) {
      const cell = read(board.tCells, trace * MAX_LEN + i);
      const d = distance(board, cell, hand.x, hand.y);
      if (d < bestDistance && d > 2.5 && isStraight(read(board.mask, cell))) {
        bestDistance = d;
        bestTrace = trace;
        bestCell = cell;
      }
    }
  }
  if (bestTrace < 0) {
    return;
  }
  // Leave the run at a right angle, on the pointer's side.
  let dir = hand.x > bestCell % board.columns ? 2 : 6;
  if (read(board.mask, bestCell) === 0b0100_0100) {
    dir = hand.y < Math.floor(bestCell / board.columns) ? 0 : 4;
  }
  sproutBranch(board, bestTrace, bestCell, dir, true);
};

/** Whether a chip fits at a spot once copper is cleared: no part or label in the way. */
const roomFor = (
  board: Board,
  left: number,
  top: number,
  w: number,
  h: number
) => {
  for (let cy = top - 1; cy <= top + h; cy += 1) {
    for (let cx = left - 2; cx <= left + w + 1; cx += 1) {
      if (!inside(board, cx, cy)) {
        return false;
      }
      const cell = cy * board.columns + cx;
      const k = read(board.kind, cell);
      if (
        k === KIND.chip ||
        (k === KIND.text && read(board.owner, cell) >= 0)
      ) {
        return false;
      }
    }
  }
  return true;
};

/** Clear copper and loose silkscreen from a chip's footprint. */
const clearFootprint = (
  board: Board,
  left: number,
  top: number,
  w: number,
  h: number
) => {
  for (let cy = top - 1; cy <= top + h; cy += 1) {
    for (let cx = left - 2; cx <= left + w + 1; cx += 1) {
      const cell = cy * board.columns + cx;
      const k = read(board.kind, cell);
      if (k === KIND.text) {
        setCell(board, cx, cy, KIND.empty, 0, -1);
      } else if (k !== KIND.empty) {
        removeTrace(board, read(board.owner, cell));
      }
    }
  }
};

const DROP_OFFSETS = [
  [0, 0],
  [4, 0],
  [-4, 0],
  [0, 2],
  [0, -2],
] as const;

/** Drop a chip under the pointer, clearing any copper in its way. */
const dropChip = (board: Board, x: number, y: number) => {
  const [w, h] = chipSize(board);
  for (const [ox, oy] of DROP_OFFSETS) {
    const left = Math.round(x - w / 2) + ox;
    const top = Math.round(y - h / 2) + oy;
    if (roomFor(board, left, top, w, h)) {
      clearFootprint(board, left, top, w, h);
      const chip = placeChip(board, left, top, w, h);
      // A new part boots with a few traces already reaching out.
      let grown = 0;
      for (let pin = 0; pin < MAX_PINS && grown < 4; pin += 1) {
        if (
          chip >= 0 &&
          read(board.pChip, pin) === chip &&
          random(board) < 0.5
        ) {
          grown += sproutFromPin(board, pin, false) >= 0 ? 1 : 0;
        }
      }
      if (liveChips(board) > board.chipTarget + 4) {
        board.nextRetire = board.time;
      }
      return;
    }
  }
};

/** Retire the oldest chip: its traces retract, then it lifts off. */
const retireOldest = (board: Board) => {
  let oldest = -1;
  for (let chip = 0; chip < MAX_CHIPS; chip += 1) {
    if (
      read(board.cState, chip) === CHIP_STATE.live &&
      (oldest < 0 || read(board.cBorn, chip) < read(board.cBorn, oldest))
    ) {
      oldest = chip;
    }
  }
  if (oldest < 0) {
    return;
  }
  board.cState[oldest] = CHIP_STATE.retiring;
  for (let trace = 0; trace < MAX_TRACES; trace += 1) {
    if (
      read(board.tState, trace) !== STATE.free &&
      read(board.tChip, trace) === oldest
    ) {
      killTrace(board, trace);
    }
  }
};

/** Chips cool down, and now and then one powers up with its traces. */
const tickPower = (board: Board) => {
  const keep = Math.exp(-STEP / 2.2);
  for (let chip = 0; chip < MAX_CHIPS; chip += 1) {
    board.cPower[chip] = read(board.cPower, chip) * keep;
  }
  if (board.time >= board.nextPower) {
    const chip = randomInt(board, 0, MAX_CHIPS - 1);
    if (read(board.cState, chip) === CHIP_STATE.live) {
      board.cPower[chip] = 1;
      board.nextPower = board.time + 2 + random(board) * 4;
    }
  }
};

const BOOST_KEEP = Math.exp(-STEP / 4);

/** A finished trace fires electrons, and a root trace retires with age. */
const tickDone = (board: Board, trace: number, traffic: number) => {
  board.tBoost[trace] = read(board.tBoost, trace) * BOOST_KEEP;
  const chip = read(board.tChip, trace);
  const power = chip >= 0 ? read(board.cPower, chip) : 0;
  const charge = Math.max(power, read(board.tBoost, trace));
  if (random(board) < traffic * STEP * (0.12 + 1.1 * charge)) {
    firePulse(board, trace);
  }
  if (
    read(board.tParent, trace) === -1 &&
    board.time - read(board.tDoneAt, trace) > read(board.tLife, trace)
  ) {
    killTrace(board, trace);
  }
};

/** Advance every trace one step; returns how many are still growing. */
const tickTraces = (board: Board, knobs: Knobs, hand: Readonly<Hand>) => {
  let growing = 0;
  const growChance = Math.min(1, 0.42 * knobs.growth);
  const pointerX = hand.active ? hand.x : -1;
  for (let trace = 0; trace < MAX_TRACES; trace += 1) {
    const state = read(board.tState, trace);
    if (state === STATE.growing) {
      growing += 1;
      if (!hand.active) {
        board.tAttract[trace] = 0;
      }
      if (random(board) < growChance) {
        growTrace(board, trace, pointerX, hand.y);
      }
    } else if (state === STATE.done) {
      tickDone(board, trace, knobs.traffic);
    } else if (
      state === STATE.dying &&
      read(board.tChildren, trace) === 0 &&
      random(board) < 0.7
    ) {
      retract(board, trace);
    }
  }
  return growing;
};

const reachingCount = (board: Board) => {
  let count = 0;
  for (let trace = 0; trace < MAX_TRACES; trace += 1) {
    if (read(board.tState, trace) === STATE.growing) {
      count += read(board.tAttract, trace);
    }
  }
  return count;
};

/** The pointer powers chips near it and grows copper toward itself. */
const tickHand = (board: Board, knobs: Knobs, hand: Readonly<Hand>) => {
  if (!hand.active) {
    return;
  }
  if (knobs.growth > 0 && board.ticks % 3 === 0 && reachingCount(board) < 6) {
    if (board.ticks % 6 === 0) {
      reachFromPin(board, hand);
    } else if (board.ticks % 9 === 3) {
      reachFromTrace(board, hand);
    }
  }
  for (let chip = 0; chip < MAX_CHIPS; chip += 1) {
    const cx = read(board.cX, chip) + read(board.cW, chip) / 2;
    const cy = read(board.cY, chip) + read(board.cH, chip) / 2;
    const d = Math.hypot((cx - hand.x) * board.aspect, cy - hand.y);
    if (read(board.cState, chip) === CHIP_STATE.live && d < 9) {
      board.cPower[chip] = Math.max(read(board.cPower, chip), 0.75);
    }
  }
  if (hand.pressed) {
    dropChip(board, hand.x, hand.y);
  }
};

const hasTraces = (board: Board, chip: number) => {
  for (let trace = 0; trace < MAX_TRACES; trace += 1) {
    if (
      read(board.tState, trace) !== STATE.free &&
      read(board.tChip, trace) === chip
    ) {
      return true;
    }
  }
  return false;
};

/** The board keeps evolving: the oldest chip retires and a new one lands. */
const tickChips = (board: Board, chips: number) => {
  if (board.time >= board.nextRetire) {
    if (chips >= board.chipTarget) {
      retireOldest(board);
    }
    board.nextRetire = board.time + 14 + random(board) * 12;
  }
  for (let chip = 0; chip < MAX_CHIPS; chip += 1) {
    if (
      read(board.cState, chip) === CHIP_STATE.retiring &&
      !hasTraces(board, chip)
    ) {
      clearChip(board, chip);
      if (liveChips(board) < board.chipTarget) {
        scatterChip(board);
      }
    }
  }
};

const tick = (board: Board, knobs: Knobs, hand: Readonly<Hand>) => {
  board.time += STEP;
  board.ticks += 1;
  tickPower(board);
  const growing = tickTraces(board, knobs, hand);

  // Keep a few vines growing out of free pins.
  const chips = liveChips(board);
  const target = Math.max(3, Math.min(20, Math.round(chips * 1.3)));
  if (knobs.growth > 0 && growing < target && random(board) < 0.5) {
    const pin = freePin(board);
    if (pin >= 0) {
      sproutFromPin(board, pin, false);
    }
  }
  tickHand(board, knobs, hand);
  tickChips(board, chips);
};

// --- Light ----------------------------------------------------------------------

/** Per-trace brightness, growing tips, powered copper's warmth. */
const paintTraces = (board: Board) => {
  const { flash, heat, tCells, time } = board;
  for (let trace = 0; trace < MAX_TRACES; trace += 1) {
    const state = read(board.tState, trace);
    if (state === STATE.free) {
      continue;
    }
    const chip = read(board.tChip, trace);
    const power = chip >= 0 ? read(board.cPower, chip) : 0;
    const len = read(board.tLen, trace);
    const base = trace * MAX_LEN;
    let bright = 0.22 + 0.2 * power;
    if (state === STATE.growing) {
      bright = 0.82 + 0.18 * power;
      const tip = read(tCells, base + len - 1);
      flash[tip] = 1;
      heat[tip] = read(heat, tip) + 0.15;
    } else if (state === STATE.done) {
      const age = time - read(board.tDoneAt, trace);
      const charge = Math.max(power, read(board.tBoost, trace));
      bright = 0.36 + 0.3 * Math.exp(-age / 7) + 0.4 * charge;
      if (charge > 0.12) {
        const warmth = 0.12 * charge;
        for (let i = 0; i < len; i += 2) {
          const cell = read(tCells, base + i);
          heat[cell] = read(heat, cell) + warmth;
        }
      }
    }
    board.tBright[trace] = Math.min(1, bright);
  }
};

/**
 * Blur this frame's light into the glow and let the glow spread and fade,
 * so pulses leave a halo and powered regions bathe in a soft cyan.
 */
const diffuse = (board: Board, keep: number) => {
  const { columns, rows, heat, glow } = board;
  for (let i = 0; i < heat.length; i += 1) {
    heat[i] = read(heat, i) + read(glow, i) * keep;
  }
  for (let y = 0; y < rows; y += 1) {
    const up = y > 0 ? -columns : 0;
    const down = y < rows - 1 ? columns : 0;
    for (let x = 0; x < columns; x += 1) {
      const i = y * columns + x;
      const left = x > 0 ? i - 1 : i;
      const right = x < columns - 1 ? i + 1 : i;
      glow[i] = Math.min(
        3,
        read(heat, i) * 0.36 +
          (read(heat, left) + read(heat, right)) * 0.2 +
          (read(heat, i + up) + read(heat, i + down)) * 0.12
      );
    }
  }
  heat.fill(0);
};

const warmBoard = (
  context: AsciiGridDrawContext,
  density: number,
  seed: number,
  knobs: Knobs,
  key: string
): Board => {
  const { columns, rows, metrics } = context;
  const board = createBoard(
    columns,
    rows,
    metrics.width / metrics.height,
    density,
    seed,
    key
  );
  for (let chip = 0; chip < board.chipTarget; chip += 1) {
    scatterChip(board);
  }
  printMarks(board);
  // Grow ahead so the first frame (and a still frame) is a living board.
  const warm = { growth: Math.max(1, knobs.growth), traffic: knobs.traffic };
  for (let i = 0; i < 720; i += 1) {
    tick(board, warm, NO_HAND);
    movePulses(board, STEP);
  }
  for (let i = 0; i < 10; i += 1) {
    paintTraces(board);
    paintPulses(board);
    diffuse(board, 0.82);
  }
  return board;
};

// --- Drawing --------------------------------------------------------------------

/** Where a frame's colours go and the lookup they come from. */
interface Paint {
  lut: Uint8ClampedArray;
  colors: Uint8ClampedArray | null;
}

const paintCell = (
  paint: Paint,
  cell: number,
  family: number,
  level: number
) => {
  const { colors, lut } = paint;
  if (!colors) {
    return;
  }
  const step =
    level >= 1 ? LEVELS - 1 : Math.max(0, Math.floor(level * LEVELS));
  const at = (family * LEVELS + step) * 3;
  const out = cell * 4;
  colors[out] = read(lut, at);
  colors[out + 1] = read(lut, at + 1);
  colors[out + 2] = read(lut, at + 2);
  colors[out + 3] = 255;
};

interface Look {
  readonly key: string;
  readonly set: GlyphSet;
  readonly texture: readonly string[];
}

/** Bare board: the mask's grain, or the glow around live copper. */
const drawMask = (
  board: Board,
  glyphs: string[],
  paint: Paint,
  look: Look,
  cell: number
) => {
  const top = TEXTURE_STEPS - 1;
  const light = read(board.glow, cell);
  const grain = read(board.base, cell);
  const tone = grain + Math.min(0.8, light * 1.6);
  glyphs[cell] = look.texture[Math.min(top, Math.round(tone * top))] ?? " ";
  if (light > 0.04) {
    paintCell(paint, cell, FAMILY.glow, 0.25 + light * 1.4);
  } else {
    paintCell(paint, cell, FAMILY.mask, 0.45 + grain * 3);
  }
};

/** Copper: box drawing in its own brightness, or hot where a pulse runs. */
const drawTrace = (
  board: Board,
  glyphs: string[],
  paint: Paint,
  look: Look,
  cell: number
) => {
  const hot = read(board.flash, cell);
  const mask = read(board.mask, cell);
  if (hot > 0.08) {
    glyphs[cell] =
      (hot > 0.6 ? look.set.hot[mask] : look.set.trace[mask]) ?? "+";
    paintCell(paint, cell, FAMILY.pulse, 0.25 + hot * 0.75);
  } else {
    glyphs[cell] = look.set.trace[mask] ?? "+";
    paintCell(
      paint,
      cell,
      FAMILY.copper,
      read(board.tBright, read(board.owner, cell))
    );
  }
};

/** A via or pad: hollow at rest, filled when powered or a pulse lands. */
const drawEnd = (
  board: Board,
  glyphs: string[],
  paint: Paint,
  look: Look,
  cell: number
) => {
  const trace = read(board.owner, cell);
  const light = read(board.glow, cell);
  const level = read(board.tBright, trace) + light * 0.5;
  const lit = level > 0.75 || light > 0.25;
  const { set } = look;
  if (read(board.tEnd, trace) === KIND.via) {
    glyphs[cell] = lit ? set.viaHot : set.via;
  } else {
    glyphs[cell] = lit ? set.padHot : set.pad;
  }
  paintCell(paint, cell, light > 0.5 ? FAMILY.pulse : FAMILY.via, level);
};

const chipLevel = (board: Board, chip: number, rest: number) =>
  (rest + read(board.cPower, chip) * (1 - rest)) *
  (read(board.cState, chip) === CHIP_STATE.retiring ? 0.5 : 1);

/** A chip's package, pins and pin-1 dot. */
const drawChip = (
  board: Board,
  glyphs: string[],
  paint: Paint,
  look: Look,
  cell: number
) => {
  const chip = read(board.owner, cell);
  const part = read(board.mask, cell);
  if (part === PART.body) {
    glyphs[cell] = look.texture[2] ?? " ";
    paintCell(paint, cell, FAMILY.chip, chipLevel(board, chip, 0.55));
  } else if (part === PART.dot) {
    glyphs[cell] = look.set.chip[part] ?? "*";
    paintCell(paint, cell, FAMILY.silk, chipLevel(board, chip, 0.45));
  } else {
    glyphs[cell] = look.set.chip[part] ?? "+";
    paintCell(paint, cell, FAMILY.tin, chipLevel(board, chip, 0.5));
  }
};

/** Silkscreen: chip labels and the marks printed between parts. */
const drawText = (
  board: Board,
  glyphs: string[],
  paint: Paint,
  cell: number
) => {
  const chip = read(board.owner, cell);
  glyphs[cell] = board.text[cell] ?? " ";
  if (chip >= 0) {
    paintCell(paint, cell, FAMILY.silk, chipLevel(board, chip, 0.62));
  } else {
    paintCell(paint, cell, FAMILY.silk, 0.3 + read(board.glow, cell) * 0.6);
  }
};

const render = (board: Board, glyphs: string[], paint: Paint, look: Look) => {
  const { kind } = board;
  for (let cell = 0; cell < kind.length; cell += 1) {
    const k = read(kind, cell);
    if (k === KIND.empty) {
      drawMask(board, glyphs, paint, look, cell);
    } else if (k === KIND.trace) {
      drawTrace(board, glyphs, paint, look, cell);
    } else if (k === KIND.via || k === KIND.pad) {
      drawEnd(board, glyphs, paint, look, cell);
    } else if (k === KIND.chip) {
      drawChip(board, glyphs, paint, look, cell);
    } else {
      drawText(board, glyphs, paint, cell);
    }
  }
};

/** Run the simulation for one frame's worth of time. */
const advance = (
  board: Board,
  knobs: Knobs,
  { pointer, delta }: AsciiGridDrawContext,
  interactive: boolean
) => {
  const live = interactive && pointer.inside;
  const down = live && pointer.down;
  const { hand } = board;
  hand.active = live;
  hand.x = pointer.x;
  hand.y = pointer.y;
  // Held until a step runs, so a quick tap is never lost.
  hand.pressed = hand.pressed || (down && !board.wasDown);
  board.wasDown = down;
  const dt = Math.min(delta, 0.1);
  board.carry += dt;
  for (let steps = 0; board.carry >= STEP && steps < 4; steps += 1) {
    tick(board, knobs, hand);
    hand.pressed = false;
    board.carry -= STEP;
  }
  board.carry = Math.min(board.carry, STEP);
  movePulses(board, dt);
};

/** A faint halo where the pointer is powering the board. */
const paintHand = (board: Board) => {
  const { hand, columns, rows, heat } = board;
  if (!hand.active) {
    return;
  }
  const px = Math.floor(hand.x);
  const py = Math.floor(hand.y);
  for (let y = Math.max(0, py - 1); y <= Math.min(rows - 1, py + 1); y += 1) {
    for (
      let x = Math.max(0, px - 3);
      x <= Math.min(columns - 1, px + 3);
      x += 1
    ) {
      const at = y * columns + x;
      heat[at] = read(heat, at) + 0.05;
    }
  }
};

const clampKnob = (value: number) => Math.min(3, Math.max(0, value));

const lookFor = (
  charset: CircuitBloomSceneProps["charset"],
  chars: string | undefined
): Look => {
  const set = resolveCharset(charset, chars);
  return {
    key: `${charset}|${chars ?? ""}`,
    set: set.id === "standard" ? ASCII_GLYPHS : UNICODE_GLYPHS,
    texture: textureGlyphs(set),
  };
};

/**
 * Silicon Bloom. A circuit board that grows itself: chips with pin rows,
 * copper traces that vine out of their pins at 0°, 45° and 90°, ending in
 * vias and pads, with electrons racing along finished runs. Regions power
 * up, old copper retracts and new parts land. The pointer powers nearby
 * pins so branches sprout toward it; a click drops a new chip.
 */
export const CircuitBloomScene = ({
  charset = "braille",
  chars,
  colorMode = "truecolor",
  phosphor,
  ramp,
  ansi,
  grade,
  // Tone-mapping props have nothing to map here: glyphs are written directly.
  invert: _invert,
  threshold: _threshold,
  edgeThreshold: _edgeThreshold,
  dither: _dither,
  background = "paper",
  fx = DEFAULT_FX,
  cell = 12,
  speed = 1,
  animate = true,
  fps = 30,
  stillTime = 0,
  interactive = true,
  handle,
  growth = 1,
  density = 1,
  traffic = 1,
  board = "green",
  seed = 7,
  className,
  ...props
}: CircuitBloomSceneProps) => {
  const boardRef = useRef<Board | null>(null);
  const lookRef = useRef<Look | null>(null);
  const paintRef = useRef<Paint>({
    colors: null,
    lut: new Uint8ClampedArray(0),
  });
  const tokens = useAsciiColors();
  const palette = BOARDS[board];

  const surface = surfaceColors(
    { background, colorMode, phosphor, ramp },
    palette.backdrop
  );
  const lut = useMemo(() => {
    const glass = colorMode === "mono" && phosphor ? PHOSPHORS[phosphor] : null;
    const ink = glass
      ? hexToRgb(glass.ink)
      : toBytes(tokens?.[0], [230, 240, 235]);
    const paper = glass
      ? hexToRgb(glass.paper)
      : toBytes(tokens?.[1], hexToRgb(palette.backdrop));
    return buildLut(
      palette,
      createInk({ ansi, colorMode, grade, ramp }, ink, paper)
    );
  }, [ansi, colorMode, grade, palette, phosphor, ramp, tokens]);

  const knobs: Knobs = {
    growth: clampKnob(growth),
    traffic: clampKnob(traffic),
  };
  const spread = Math.min(3, Math.max(0.25, density));

  const draw = (context: AsciiGridDrawContext) => {
    const { frame, columns, rows, delta, time } = context;
    const boardKey = `${columns}x${rows}x${spread}x${seed}`;
    if (boardRef.current?.key !== boardKey) {
      boardRef.current = warmBoard(context, spread, seed, knobs, boardKey);
      // A still frame shows the moment `stillTime` asks for.
      const extra = delta === 0 ? Math.min(900, time / STEP) : 0;
      for (let i = 0; i < extra; i += 1) {
        tick(boardRef.current, knobs, NO_HAND);
        movePulses(boardRef.current, STEP);
      }
    }
    const state = boardRef.current;
    const lookKey = `${charset}|${chars ?? ""}`;
    if (lookRef.current?.key !== lookKey) {
      lookRef.current = lookFor(charset, chars);
    }
    if (delta > 0) {
      advance(state, knobs, context, interactive);
    }

    state.flash.fill(0);
    paintTraces(state);
    paintPulses(state);
    paintHand(state);
    diffuse(state, Math.exp(-(delta > 0 ? Math.min(delta, 0.1) : STEP) * 6));
    const paint = paintRef.current;
    paint.colors = frame.colors;
    paint.lut = lut;
    render(state, frame.glyphs, paint, lookRef.current);
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
