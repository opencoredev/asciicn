"use client";

import { useRef } from "react";
import type { ComponentProps, RefObject } from "react";

import { AsciiGrid, PHOSPHORS, useAsciiColors } from "@/lib/ascii";
import type {
  AsciiGridDrawContext,
  AsciiHandle,
  PhosphorName,
  PostFx,
  Rgb8,
} from "@/lib/ascii";

/**
 * Which glyphs draw the rack.
 * - `cp437`: box drawing, shades and bullets from the IBM PC set.
 * - `standard`: plain ASCII only, for terminals and fonts without box drawing.
 */
export const RACK_CHARSETS = ["cp437", "standard"] as const;
export type RackCharset = (typeof RACK_CHARSETS)[number];

/** `truecolor` lights the LEDs and cables in colour; `mono` draws everything in the ink. */
export const RACK_COLOR_MODES = ["truecolor", "mono"] as const;
export type RackColorMode = (typeof RACK_COLOR_MODES)[number];

export interface ServerRackProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  /** Height of the rack in rack units. Each unit is two rows of glyphs. Default 18. */
  units?: number;
  /** How busy the machines are, from 0 (idle) to 1 (flat out). Drives the drive LEDs, port lights and fibre pulses. Default 0.6. */
  activity?: number;
  /** `true` blinks one unit amber; a number flags the unit at that rack position, counted from the bottom. Default `false`. */
  alert?: boolean | number;
  /** How much the scene shows, from 0 (empty paper) to 1. Lower it under body text. Default 1. */
  intensity?: number;
  /** Default `"cp437"`. */
  charset?: RackCharset;
  /** Default `"truecolor"`, or `"mono"` with a phosphor. */
  colorMode?: RackColorMode;
  /** A CRT ink and glass that replace the ink and paper. Default: none. */
  phosphor?: PhosphorName;
  /** `"transparent"` draws the glyphs only, over your own surface. Default `"paper"`. */
  background?: "paper" | "transparent";
  /** CRT finish drawn over the glyphs. Default: none. */
  fx?: PostFx;
  /** Cell height in CSS pixels. Default 12. */
  cell?: number;
  /** Time multiplier. Default 1. */
  speed?: number;
  /** `false` holds one still frame. Default `true`. */
  animate?: boolean;
  /** The moment drawn when motion is off or reduced, in seconds. Default 4.2. */
  stillTime?: number;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

/* -------------------------------------------------------------------------- */
/* Glyphs                                                                      */
/* -------------------------------------------------------------------------- */

interface RackGlyphs {
  wall: {
    h: string;
    v: string;
    tl: string;
    tr: string;
    bl: string;
    br: string;
    pass: string;
  };
  rail: string;
  screw: string;
  bezel: { tl: string; tr: string; bl: string; br: string; v: string };
  ledOn: string;
  ledOff: string;
  jack: string;
  fibre: string;
  sfp: string;
  bay: string;
  handle: string;
  vent: string;
  plate: string;
  power: string;
  outlet: string;
  pdu: string;
  fan: readonly string[];
  /** LCD bars over two rows: empty, half, full. */
  bar: readonly [string, string, string];
  cellFull: string;
  cellEmpty: string;
  /** Cable glyphs indexed by a direction mask: N 1, E 2, S 4, W 8. */
  cable: readonly string[];
  /** The same shapes, lit by a passing pulse. */
  pulse: readonly string[];
}

const GLYPHS = {
  cp437: {
    bar: [" ", "▄", "█"],
    bay: "▒",
    bezel: { bl: "└", br: "┘", tl: "┌", tr: "┐", v: "│" },
    cable: [..." │─└│││├─┘─┴┐┤┬┼"],
    cellEmpty: "░",
    cellFull: "█",
    fan: ["│", "/", "─", "\\"],
    fibre: "◘",
    handle: "═",
    jack: "■",
    ledOff: "·",
    ledOn: "•",
    outlet: "◘",
    pdu: "▐",
    plate: "∙",
    power: "○",
    pulse: [..." ║═╚║║╔╠═╝═╩╗╣╦╬"],
    rail: "│",
    screw: "◘",
    sfp: "▄",
    vent: "≡",
    wall: { bl: "╚", br: "╝", h: "═", pass: "╪", tl: "╔", tr: "╗", v: "║" },
  },
  standard: {
    bar: [" ", ".", "|"],
    bay: ":",
    bezel: { bl: "\\", br: "/", tl: "/", tr: "\\", v: "|" },
    cable: [..." |-'||.+-'-+.+++"],
    cellEmpty: "-",
    cellFull: "#",
    fan: ["|", "/", "-", "\\"],
    fibre: "o",
    handle: "=",
    jack: "#",
    ledOff: ".",
    ledOn: "*",
    outlet: "o",
    pdu: "!",
    plate: ".",
    power: "O",
    pulse: [..." ###############"],
    rail: "|",
    screw: "o",
    sfp: "=",
    vent: ":",
    wall: { bl: "+", br: "+", h: "=", pass: "+", tl: "+", tr: "+", v: "#" },
  },
} as const satisfies Record<RackCharset, RackGlyphs>;

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

type UnitKind =
  | "patch"
  | "switch"
  | "server"
  | "compute"
  | "storage"
  | "blank"
  | "ups";

interface Unit {
  kind: UnitKind;
  /** Height in rack units. */
  size: 1 | 2;
  /** First rack unit it covers, counted from the top, 0-based. */
  top: number;
  name: string;
  seed: number;
}

const SIZES = {
  blank: 1,
  compute: 2,
  patch: 1,
  server: 1,
  storage: 2,
  switch: 1,
  ups: 2,
} as const satisfies Record<UnitKind, 1 | 2>;

const NAMES = {
  blank: "",
  compute: "gpu",
  patch: "fibre",
  server: "web",
  storage: "nas",
  switch: "core",
  ups: "ups",
} as const satisfies Record<UnitKind, string>;

/** Machines are numbered; shared gear keeps a plain name. */
const NUMBERED = {
  blank: false,
  compute: true,
  patch: false,
  server: true,
  storage: true,
  switch: false,
  ups: false,
} as const satisfies Record<UnitKind, boolean>;

// The middle of the rack repeats this mix, shifted per rack so neighbours differ.
const FILL: readonly UnitKind[] = [
  "server",
  "server",
  "compute",
  "blank",
  "storage",
  "server",
  "compute",
  "server",
  "storage",
  "blank",
];

/** Units from the top: network gear first, the UPS at the bottom, machines between. */
const layout = (units: number, shift: number): Unit[] => {
  const list: Unit[] = [];
  const counts: Partial<Record<UnitKind, number>> = {};
  const unitAt = (kind: UnitKind, top: number): Unit => {
    const count = (counts[kind] ?? 0) + 1;
    counts[kind] = count;
    const name = NUMBERED[kind]
      ? `${NAMES[kind]}-${String(count).padStart(2, "0")}`
      : NAMES[kind];
    return {
      kind,
      name,
      seed: shift * 97 + top * 13 + 7,
      size: SIZES[kind],
      top,
    };
  };
  const plan: UnitKind[] = units >= 4 ? ["patch", "switch"] : [];
  const bottom = units >= 8 ? 2 : 0;
  let used = plan.length;
  for (let index = shift; used < units - bottom; index += 1) {
    const kind = FILL[index % FILL.length] ?? "server";
    // A 2U machine that doesn't fit becomes a 1U server.
    const fits = used + SIZES[kind] <= units - bottom;
    const placed = fits ? kind : "server";
    plan.push(placed);
    used += SIZES[placed];
  }
  if (bottom > 0) {
    plan.push("ups");
  }
  let top = 0;
  for (const kind of plan) {
    list.push(unitAt(kind, top));
    top += SIZES[kind];
  }
  return list;
};

/* -------------------------------------------------------------------------- */
/* Rhythm                                                                      */
/* -------------------------------------------------------------------------- */

// A float hash in [0, 1): cheap, stable for integer inputs, no bitwise maths.
const hash = (a: number, b: number): number => {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

/**
 * Disk and port activity: busy spells of a few seconds come and go, and
 * inside a spell the light blinks a couple of times a second, unevenly,
 * like real I/O. Fewer than half the lights are in a spell at once, so the
 * rack hums rather than strobes.
 */
const burst = (seed: number, time: number, activity: number): boolean => {
  const spell = time * 0.22 + hash(seed, 1) * 9;
  if (hash(seed, Math.floor(spell)) > activity * 0.6) {
    return false;
  }
  return hash(seed + 3, Math.floor(time * 2.5 + hash(seed, 2) * 7)) < 0.62;
};

/** The health LED: a slow double beat, lub-dub, then a long rest. */
const heartbeat = (seed: number, time: number): number => {
  const phase = (time / 2.4 + hash(seed, 5)) % 1;
  if (phase < 0.07) {
    return 1;
  }
  if (phase > 0.13 && phase < 0.19) {
    return 0.75;
  }
  return 0;
};

/** The alert flash: a steady on, a softer off, about every two seconds. */
const alarmAt = (time: number): number => {
  const phase = (time * 0.5) % 1;
  if (phase < 0.45) {
    return 1;
  }
  return phase < 0.6 ? 0.35 : 0;
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

interface RackColors {
  paper: Rgb8;
  ink: Rgb8;
  green: Rgb8;
  amber: Rgb8;
  blue: Rgb8;
  /** Fibre jackets: aqua multimode, violet, and copper blue. */
  cables: readonly [Rgb8, Rgb8, Rgb8];
}

/** Theme colours as bytes. In mono every light takes the ink. */
const rackColors = (
  theme: readonly (readonly number[])[] | null,
  mono: boolean
): RackColors => {
  const ink = toBytes(theme?.[0], [230, 230, 230]);
  const tint = (rgba: readonly number[] | undefined, fallback: Rgb8) =>
    mono ? ink : toBytes(rgba, fallback);
  const green = tint(theme?.[2], [80, 220, 120]);
  const blue = tint(theme?.[4], [90, 160, 255]);
  return {
    amber: tint(theme?.[3], [250, 170, 60]),
    blue,
    cables: [mix(blue, green, 0.55), tint(theme?.[5], [180, 120, 255]), blue],
    green,
    ink,
    paper: toBytes(theme?.[1], [0, 0, 0]),
  };
};

/** One shade of the chassis, from the paper (0) to the ink (1). */
const steel = (colors: RackColors, level: number): Rgb8 =>
  mix(colors.paper, colors.ink, level);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/* -------------------------------------------------------------------------- */
/* Units                                                                       */
/* -------------------------------------------------------------------------- */

// Cable directions, summed into a mask.
const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DIRECTIONS = [N, E, S, W] as const;

/** Both masks' directions, without bitwise maths. */
const union = (a: number, b: number): number => {
  let sum = 0;
  for (const bit of DIRECTIONS) {
    if (Math.floor(a / bit) % 2 === 1 || Math.floor(b / bit) % 2 === 1) {
      sum += bit;
    }
  }
  return sum;
};

// Columns around the face: wall, gap, PDU strip, rail | face | rail, cable channel, wall.
const LEFT = 4;
const LANES = 3;
const CHANNEL = LANES * 2 + 1;
const RIGHT = 1 + CHANNEL + 1;

interface Painter {
  put: (x: number, y: number, glyph: string, color: Rgb8) => void;
  colors: RackColors;
  g: RackGlyphs;
  time: number;
  activity: number;
}

/** Where a unit's face sits, and how loudly it is flashing. */
interface Face {
  x: number;
  y: number;
  width: number;
  alarm: number;
}

/** Writes `value` from (x, y) and returns the column after it. */
const text = (
  p: Painter,
  x: number,
  y: number,
  value: string,
  color: Rgb8
): number => {
  let column = x;
  for (const glyph of value) {
    p.put(column, y, glyph, color);
    column += 1;
  }
  return column;
};

/** Ports in groups of six, each lit while its link is up and dark for a blink of traffic. */
const ports = (
  p: Painter,
  x: number,
  y: number,
  width: number,
  seed: number,
  glyph: string,
  color: Rgb8
) => {
  for (let i = 0; i < width; i += 1) {
    if (i % 7 === 6) {
      continue;
    }
    const port = seed * 61 + i;
    let tint = steel(p.colors, 0.28);
    if (hash(port, 11) < 0.82) {
      tint = burst(port, p.time, p.activity) ? steel(p.colors, 0.35) : color;
    }
    p.put(x + i, y, glyph, tint);
  }
};

/** The status cluster most units share: power, heartbeat and the locator or alert LED. */
const statusLeds = (
  p: Painter,
  x: number,
  y: number,
  unit: Unit,
  alarm: number
) => {
  const { colors, g } = p;
  const off = steel(colors, 0.3);
  p.put(x, y, g.power, steel(colors, 0.55));
  const beat = heartbeat(unit.seed, p.time);
  p.put(x + 2, y, beat > 0 ? g.ledOn : g.ledOff, mix(off, colors.green, beat));
  if (alarm > 0) {
    p.put(x + 4, y, g.ledOn, mix(off, colors.amber, alarm));
    return;
  }
  // The locator LED glows blue now and then, as if someone is looking for the box.
  const locate = hash(unit.seed, Math.floor(p.time / 7)) < 0.12;
  p.put(x + 4, y, locate ? g.ledOn : g.ledOff, locate ? colors.blue : off);
};

/** A two-row LCD of load bars that scroll left, one step every two seconds. */
const lcd = (p: Painter, x: number, y: number, width: number, seed: number) => {
  const { colors, g } = p;
  const lit = mix(colors.paper, mix(colors.green, colors.ink, 0.3), 0.75);
  for (let i = 0; i < width; i += 1) {
    const step = Math.floor(p.time * 0.5) + i;
    const load = clamp(
      0.15 + p.activity * 0.7 * hash(seed, step) + 0.15 * hash(seed + 1, step),
      0,
      1
    );
    const level = Math.round(load * 4);
    p.put(x + i, y, g.bar[Math.max(0, level - 2)] ?? " ", lit);
    p.put(x + i, y + 1, g.bar[Math.min(2, level)] ?? " ", lit);
  }
};

/** One drive sled: its activity LED, then the sled face ending in a handle. */
const bay = (
  p: Painter,
  x: number,
  y: number,
  width: number,
  seed: number,
  handleRow: boolean
) => {
  const { colors, g } = p;
  const busy = burst(seed, p.time, p.activity);
  // The odd empty slot, for realism.
  const empty = hash(seed, 21) < 0.05;
  p.put(
    x,
    y,
    busy ? g.ledOn : g.ledOff,
    busy ? colors.blue : steel(colors, 0.3)
  );
  if (empty) {
    return;
  }
  for (let i = 1; i < width; i += 1) {
    const last = i === width - 1;
    p.put(x + i, y, last ? g.handle : g.bay, steel(colors, last ? 0.55 : 0.4));
    if (handleRow) {
      p.put(x + i, y + 1, g.handle, steel(colors, 0.34));
    }
  }
};

/** Fans turning behind a vent grille, faster when busy. */
const fans = (p: Painter, x: number, y: number, width: number) => {
  const { colors, g } = p;
  for (let r = 0; r < 4; r += 1) {
    for (let i = 0; i < width; i += 1) {
      p.put(x + i, y + r, g.vent, steel(colors, 0.26));
    }
  }
  const count = Math.max(1, Math.floor(width / 4));
  for (let f = 0; f < count; f += 1) {
    // A few steps a second: the fans read as turning, not as a strobe.
    const spin = Math.floor(p.time * (1.5 + p.activity * 2.5) + f);
    const at = x + 1 + f * 4;
    for (let r = 1; r <= 2; r += 1) {
      p.put(at, y + r, "(", steel(colors, 0.4));
      p.put(
        at + 1,
        y + r,
        g.fan[(spin + r * 2) % g.fan.length] ?? "|",
        steel(colors, 0.7)
      );
      p.put(at + 2, y + r, ")", steel(colors, 0.4));
    }
  }
};

const drawPatch = (p: Painter, unit: Unit, face: Face, label: Rgb8) => {
  const { colors, g } = p;
  const start = text(p, face.x, face.y, unit.name, label) + 1;
  const span = face.width - unit.name.length - 1;
  ports(p, start, face.y, span, unit.seed, g.fibre, colors.cables[0]);
  // Each fibre's receive light, flickering when light arrives.
  for (let i = 0; i < span; i += 1) {
    if (i % 7 !== 6) {
      const on = burst(unit.seed * 31 + i, p.time, p.activity);
      p.put(
        start + i,
        face.y + 1,
        on ? g.ledOn : g.ledOff,
        on ? colors.cables[0] : steel(colors, 0.3)
      );
    }
  }
};

const drawSwitch = (p: Painter, unit: Unit, face: Face, label: Rgb8) => {
  const { colors, g } = p;
  const dim = steel(colors, 0.3);
  text(p, face.x, face.y, unit.name, label);
  text(p, face.x, face.y + 1, "48p", dim);
  const span = face.width - 12;
  ports(p, face.x + 5, face.y, span, unit.seed, g.jack, colors.green);
  ports(p, face.x + 5, face.y + 1, span, unit.seed + 1, g.jack, colors.green);
  // SFP uplinks, then the system LEDs.
  const sfp = face.x + face.width - 6;
  for (let i = 0; i < 2; i += 1) {
    const on = burst(unit.seed * 7 + i, p.time, Math.min(1, p.activity + 0.2));
    const [lit] = colors.cables;
    const dark = steel(colors, 0.45);
    p.put(sfp + i, face.y, g.sfp, on ? lit : dark);
    p.put(sfp + i, face.y + 1, g.sfp, on ? dark : lit);
  }
  statusLeds(p, sfp + 3, face.y, unit, face.alarm);
  text(p, sfp + 3, face.y + 1, "sys", dim);
};

/** Servers, GPU nodes and storage shelves. Returns where the uplink fibre leaves. */
const drawMachine = (
  p: Painter,
  unit: Unit,
  face: Face,
  label: Rgb8
): readonly [number, number] => {
  const { colors, g } = p;
  // The right end holds the status LEDs, the name and the uplink port.
  const panel = Math.min(12, Math.max(8, Math.floor(face.width * 0.28)));
  const panelX = face.x + face.width - panel;
  const storage = unit.kind === "storage";
  const bayWidth = storage ? 7 : 4;
  const vents =
    unit.kind === "compute" ? Math.floor((panelX - face.x) * 0.32) : 0;
  const bays = Math.floor((panelX - face.x - vents) / (bayWidth + 1));
  // Drive bays across the left: four rows of 3.5-inch sleds on a shelf,
  // one row of 2.5-inch sleds with handles below on a server.
  const rows = storage ? 4 : 1;
  for (let r = 0; r < rows; r += 1) {
    for (let b = 0; b < bays; b += 1) {
      const seed = unit.seed * 131 + r * 17 + b;
      bay(p, face.x + b * (bayWidth + 1), face.y + r, bayWidth, seed, !storage);
    }
  }
  if (unit.kind === "compute") {
    // A second row of sleds, and fans behind a grille.
    for (let b = 0; b < bays; b += 1) {
      const seed = unit.seed * 131 + 40 + b;
      bay(p, face.x + b * (bayWidth + 1), face.y + 2, bayWidth, seed, true);
    }
    fans(p, face.x + bays * (bayWidth + 1), face.y, vents - 1);
  }
  statusLeds(p, panelX, face.y, unit, face.alarm);
  text(p, panelX, face.y + 1, unit.name, label);
  if (unit.size === 2) {
    lcd(p, panelX, face.y + 2, panel - 2, unit.seed);
  }
  const portX = face.x + face.width - 1;
  const link = burst(unit.seed * 5 + 1, p.time, Math.min(1, p.activity + 0.15));
  p.put(
    portX,
    face.y,
    g.fibre,
    link ? (colors.cables[unit.seed % 3] ?? colors.green) : steel(colors, 0.5)
  );
  return [portX, face.y];
};

const drawBlank = (p: Painter, unit: Unit, face: Face) => {
  const tint = steel(p.colors, 0.22);
  const odd = unit.seed % 2;
  for (let i = 0; i < face.width; i += 2) {
    p.put(face.x + i + odd, face.y, p.g.plate, tint);
    p.put(face.x + i + 1 - odd, face.y + 1, p.g.plate, tint);
  }
};

const drawUps = (p: Painter, unit: Unit, face: Face, label: Rgb8) => {
  const { colors, g } = p;
  const dim = steel(colors, 0.3);
  const load = Math.round(28 + p.activity * 52 + 6 * Math.sin(p.time * 0.2));
  const lcdColor = mix(colors.green, colors.ink, 0.35);
  let at = text(p, face.x, face.y, "UPS", label);
  at = text(p, at + 2, face.y, "online", lcdColor);
  at = text(
    p,
    at + 2,
    face.y,
    `load ${String(load).padStart(2, " ")}%`,
    lcdColor
  );
  const cells = clamp(face.x + face.width - at - 2, 0, 10);
  // The battery stays topped up; one cell charges slowly.
  for (let i = 0; i < cells; i += 1) {
    const full = i < cells - 1 || Math.floor(p.time / 3) % 2 === 0;
    p.put(
      at + 2 + i,
      face.y,
      full ? g.cellFull : g.cellEmpty,
      full ? colors.green : dim
    );
  }
  statusLeds(p, face.x, face.y + 1, unit, face.alarm);
  text(p, face.x + 7, face.y + 1, "bat", dim);
  for (let r = 2; r < 4; r += 1) {
    for (let i = 0; i < face.width; i += 1) {
      p.put(face.x + i, face.y + r, g.vent, steel(colors, 0.24));
    }
  }
};

/** A unit's bezel and face. Returns its uplink port, if it has one. */
const drawUnit = (
  p: Painter,
  unit: Unit,
  x: number,
  y: number,
  width: number,
  alarm: number
): readonly [number, number] | null => {
  const { colors, g } = p;
  const rows = unit.size * 2;
  const bezel = mix(steel(colors, 0.5), colors.amber, alarm);
  const label = mix(steel(colors, 0.62), colors.amber, alarm);
  const right = x + width - 1;
  for (let row = 0; row < rows; row += 1) {
    let left: string = g.bezel.v;
    let end: string = g.bezel.v;
    if (row === 0) {
      left = g.bezel.tl;
      end = g.bezel.tr;
    } else if (row === rows - 1) {
      left = g.bezel.bl;
      end = g.bezel.br;
    }
    p.put(x, y + row, left, bezel);
    p.put(right, y + row, end, bezel);
  }
  const face: Face = { alarm, width: width - 4, x: x + 2, y };
  switch (unit.kind) {
    case "patch": {
      drawPatch(p, unit, face, label);
      return null;
    }
    case "switch": {
      drawSwitch(p, unit, face, label);
      return null;
    }
    case "server":
    case "compute":
    case "storage": {
      return drawMachine(p, unit, face, label);
    }
    case "blank": {
      drawBlank(p, unit, face);
      return null;
    }
    case "ups": {
      drawUps(p, unit, face, label);
      return null;
    }
    default: {
      const exhaustive: never = unit.kind;
      throw new Error(`Unknown unit ${String(exhaustive)}`);
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Fibres                                                                      */
/* -------------------------------------------------------------------------- */

/** Every fibre on screen, one entry per cell. */
interface CableGrid {
  /** Which way the fibre runs through the cell: N 1, E 2, S 4, W 8. */
  mask: Uint8Array;
  /** Index into the jacket colours. */
  color: Int8Array;
  /** How bright a passing pulse is here, 0 to 1. */
  pulse: Float32Array;
  /** The rack's brightness: 1 for the main rack, less down the aisle. */
  dim: Float32Array;
}

const createCableGrid = (size: number): CableGrid => ({
  color: new Int8Array(size),
  dim: new Float32Array(size),
  mask: new Uint8Array(size),
  pulse: new Float32Array(size),
});

/**
 * Lay one fibre from a machine's port out to its lane in the cable channel
 * and up out of the top of the box. Returns its cells, port end first.
 */
const layFibre = (
  grid: CableGrid,
  columns: number,
  rows: number,
  port: readonly [number, number],
  laneX: number,
  color: number,
  dim: number
): number[] => {
  const path: number[] = [];
  const mark = (x: number, y: number, bits: number) => {
    if (x < 0 || y < 0 || x >= columns || y >= rows) {
      return;
    }
    const at = y * columns + x;
    grid.mask[at] = union(grid.mask[at] ?? 0, bits);
    grid.color[at] = color;
    grid.dim[at] = dim;
    path.push(at);
  };
  const [px, py] = port;
  for (let x = px + 1; x < laneX; x += 1) {
    mark(x, py, E + W);
  }
  mark(laneX, py, W + N);
  for (let y = py - 1; y >= 0; y -= 1) {
    mark(laneX, y, N + S);
  }
  return path;
};

/** Light travelling both ways along a fibre, in packets with gaps. */
const pulses = (
  grid: CableGrid,
  path: readonly number[],
  seed: number,
  time: number,
  activity: number
) => {
  const { length } = path;
  if (length < 4) {
    return;
  }
  // One or two slow packets per fibre with long gaps between laps.
  const streams = 1 + Math.round(activity);
  for (let k = 0; k < streams; k += 1) {
    const velocity = 5 + 4 * hash(seed, 40 + k);
    const cycle = length + 24 + 60 * (1 - activity) * hash(seed, 50 + k);
    const travel = time * velocity + hash(seed, 60 + k) * cycle;
    const lap = Math.floor(travel / cycle);
    if (hash(seed * 3 + k, lap) > 0.2 + 0.5 * activity) {
      continue;
    }
    const head = travel - lap * cycle;
    // Even streams run out from the machine, odd ones back down to it.
    const outbound = k % 2 === 0;
    for (let trail = 0; trail < 4; trail += 1) {
      const step = Math.floor(head) - trail;
      if (step >= 0 && step < length) {
        const at = path[outbound ? step : length - 1 - step] ?? 0;
        grid.pulse[at] = Math.max(grid.pulse[at] ?? 0, 1 - trail * 0.28);
      }
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

interface Scene {
  frame: AsciiGridDrawContext["frame"];
  columns: number;
  rows: number;
  time: number;
  colors: RackColors;
  g: RackGlyphs;
  grid: CableGrid;
  activity: number;
  intensity: number;
  units: number;
  /** Width of a unit face in columns, and the whole rack's width and height. */
  face: number;
  rackWidth: number;
  rackHeight: number;
  /** The cabinet's top row. */
  top: number;
}

/** Which unit flashes: `true` picks the first storage shelf. */
const flagged = (
  list: readonly Unit[],
  alert: boolean | number,
  units: number
): Unit | undefined => {
  if (alert === false) {
    return undefined;
  }
  if (alert === true) {
    return (
      list.find((unit) => unit.kind === "storage") ??
      list[Math.floor(list.length / 2)]
    );
  }
  const fromTop = units - Math.round(alert);
  return list.find(
    (unit) => fromTop >= unit.top && fromTop < unit.top + unit.size
  );
};

/** One rack: cabinet, rails, PDU, units and their fibres. */
const drawRack = (
  scene: Scene,
  x0: number,
  shift: number,
  dim: number,
  pick: (list: readonly Unit[]) => Unit | undefined
) => {
  const { frame, columns, rows, colors, g, top, units, face, time } = scene;
  const list = layout(units, shift);
  const flag = pick(list);
  const scale = dim * scene.intensity;
  const put = (x: number, y: number, glyph: string, color: Rgb8) => {
    if (x < 0 || y < 0 || x >= columns || y >= rows || glyph === " ") {
      return;
    }
    frame.put(
      x,
      y,
      glyph,
      scale >= 1 ? color : mix(colors.paper, color, scale)
    );
  };
  const p: Painter = { activity: scene.activity, colors, g, put, time };
  const wall = steel(colors, 0.55);
  const right = x0 + scene.rackWidth - 1;
  const bottom = top + scene.rackHeight - 1;
  for (let x = x0 + 1; x < right; x += 1) {
    put(x, top, g.wall.h, wall);
    put(x, bottom, g.wall.h, wall);
  }
  put(x0, top, g.wall.tl, wall);
  put(right, top, g.wall.tr, wall);
  put(x0, bottom, g.wall.bl, wall);
  put(right, bottom, g.wall.br, wall);
  for (let y = top + 1; y < bottom; y += 1) {
    put(x0, y, g.wall.v, wall);
    put(right, y, g.wall.v, wall);
  }
  // Feet under the plinth.
  put(x0 + 1, bottom + 1, g.bar[2], steel(colors, 0.35));
  put(right - 1, bottom + 1, g.bar[2], steel(colors, 0.35));

  const railL = x0 + LEFT - 1;
  const faceX = x0 + LEFT;
  const railR = faceX + face;
  // The vertical PDU on the left: one outlet per unit, its power LED on top.
  const pduX = x0 + 2;
  put(pduX, top + 1, g.ledOn, colors.green);
  for (let u = 0; u < units; u += 1) {
    const y = top + 1 + u * 2;
    put(pduX, y + 1, g.outlet, steel(colors, 0.4));
    if (u > 0) {
      put(pduX, y, g.pdu, steel(colors, 0.25));
    }
    // Rails with a screw at every unit, and rack numbers outside the main rack.
    put(railL, y, g.screw, steel(colors, 0.45));
    put(railL, y + 1, g.rail, steel(colors, 0.38));
    put(railR, y, g.screw, steel(colors, 0.45));
    put(railR, y + 1, g.rail, steel(colors, 0.38));
    if (dim >= 1) {
      text(
        p,
        x0 - 3,
        y,
        String(units - u).padStart(2, "0"),
        steel(colors, 0.3)
      );
    }
  }

  const machines = list.filter((unit) => NUMBERED[unit.kind]).length;
  let cable = 0;
  const alarm = alarmAt(time);
  for (const unit of list) {
    const y = top + 1 + unit.top * 2;
    const port = drawUnit(p, unit, faceX, y, face, flag === unit ? alarm : 0);
    if (port) {
      // Lower machines take the outer lanes, so no fibre crosses another.
      const lane = Math.floor((cable * LANES) / Math.max(1, machines));
      const path = layFibre(
        scene.grid,
        columns,
        rows,
        port,
        railR + 2 + lane * 2,
        unit.seed % 3,
        dim
      );
      pulses(scene.grid, path, unit.seed, time, scene.activity);
      cable += 1;
    }
  }
};

/** Fibres last, over the rails and cabinet walls they pass. */
const drawFibres = (scene: Scene, mono: boolean) => {
  const { frame, columns, colors, g, grid, top, intensity } = scene;
  for (let at = 0; at < grid.mask.length; at += 1) {
    const bits = grid.mask[at] ?? 0;
    if (bits === 0) {
      continue;
    }
    const y = Math.floor(at / columns);
    const lit = grid.pulse[at] ?? 0;
    const jacket = colors.cables[grid.color[at] ?? 0] ?? colors.cables[0];
    let glyph = g.cable[bits] ?? "|";
    if (lit > 0.55) {
      glyph = g.pulse[bits] ?? "|";
    } else if (y === top && bits === N + S) {
      glyph = g.wall.pass;
    }
    // Fibres fade into the dark above the racks.
    const fade = top > 0 && y < top ? 0.35 + 0.65 * (y / top) : 1;
    const base = mix(colors.paper, jacket, mono ? 0.55 : 0.7);
    const color = lit > 0 ? mix(base, mix(jacket, colors.ink, 0.6), lit) : base;
    const shown = intensity * (grid.dim[at] ?? 1) * Math.max(fade, lit);
    frame.put(at % columns, y, glyph, mix(colors.paper, color, shown));
  }
};

/**
 * A data-centre rack seen from the front, drawn in glyphs on the CPU.
 * Patch panel and core switch at the top, servers, GPU nodes and storage
 * shelves in the middle, a UPS at the bottom. Drive LEDs blink in short
 * busy spells, health LEDs beat slowly, port lights blink with traffic, and
 * slow light pulses run along the fibres that climb the cable channel and
 * leave through the roof. Wide boxes show neighbouring racks, dimmer, either
 * side. It does not react to the pointer. Decorative: size it with
 * `className`, usually `absolute inset-0`.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const ServerRack = ({
  units = 18,
  activity = 0.6,
  alert = false,
  intensity = 1,
  charset = "cp437",
  colorMode,
  phosphor,
  background = "paper",
  fx,
  cell = 12,
  speed = 1,
  animate = true,
  stillTime = 4.2,
  handle,
  ...props
}: ServerRackProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const preset = phosphor ? PHOSPHORS[phosphor] : undefined;
  const mono = (colorMode ?? (preset ? "mono" : "truecolor")) === "mono";
  const theme = useAsciiColors(rootRef, [
    preset?.ink ?? "--ascii-ink",
    preset?.paper ?? "--ascii-paper",
    "green",
    "orange",
    "blue",
    "purple",
  ]);
  const cables = useRef<CableGrid>(createCableGrid(0));

  const draw = ({ frame, columns, rows, time }: AsciiGridDrawContext) => {
    const count = Math.round(clamp(units, 1, 48));
    const size = columns * rows;
    if (cables.current.mask.length === size) {
      cables.current.mask.fill(0);
      cables.current.pulse.fill(0);
    } else {
      cables.current = createCableGrid(size);
    }
    // The main rack: as wide as the box allows, up to a full 19-inch look.
    const labels = 3;
    const face = clamp(columns - LEFT - RIGHT - labels - 1, 30, 66);
    const rackWidth = LEFT + face + RIGHT;
    const rackHeight = count * 2 + 2;
    const scene: Scene = {
      activity: clamp(activity, 0, 1),
      colors: rackColors(theme, mono),
      columns,
      face,
      frame,
      g: GLYPHS[charset],
      grid: cables.current,
      intensity: clamp(intensity, 0, 1),
      rackHeight,
      rackWidth,
      rows,
      time,
      // Sit a little low, leaving room above for the fibres to climb.
      top:
        rackHeight > rows
          ? Math.floor((rows - rackHeight) / 2)
          : Math.round((rows - rackHeight) * 0.62),
      units: count,
    };
    const mainX = Math.floor((columns - rackWidth + labels) / 2);
    // Neighbouring racks fill a wide box, dimmer, as if down the aisle.
    const gap = 3;
    for (let n = 3; n >= 1; n -= 1) {
      for (const side of [-1, 1]) {
        const x0 = mainX + side * n * (rackWidth + gap);
        if (x0 + rackWidth >= 0 && x0 < columns) {
          drawRack(scene, x0, n * 3 + (side > 0 ? 1 : 5), 0.4 / n, (list) =>
            flagged(list, false, count)
          );
        }
      }
    }
    drawRack(scene, mainX, 0, 1, (list) => flagged(list, alert, count));
    drawFibres(scene, mono);
  };

  return (
    <AsciiGrid
      ref={rootRef}
      draw={draw}
      cell={cell}
      ink={preset?.ink ?? "--ascii-ink"}
      paper={
        background === "transparent"
          ? "transparent"
          : (preset?.paper ?? "--ascii-paper")
      }
      colored
      speed={speed}
      animate={animate}
      fps={30}
      stillTime={stillTime}
      handle={handle}
      fx={fx}
      {...props}
    />
  );
};
