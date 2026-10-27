"use client";

import { useEffect, useRef } from "react";
import type { ComponentProps, KeyboardEvent, RefObject } from "react";

import {
  ANSI16,
  AsciiGrid,
  CrtOverlay,
  createToneField,
  gradeRgb,
  hexToRgb,
  mapTones,
  nearestIndex,
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
  Charset,
  MapOptions,
  MutableFrame,
  PhosphorName,
  Rgb8,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/** One command in the session: what is typed at the prompt, then what it prints. */
export interface RetroCommand {
  readonly command: string;
  readonly output: readonly string[];
}

export interface RetroComputerProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** The session the computer types, looping. Default: a short tour of a disk. */
  script?: readonly RetroCommand[];
  /** The prompt before each command. Default `"C:\\>"`. */
  prompt?: string;
  /** Lines printed at power-on, above the session. Default: a memory check. */
  banner?: readonly string[];
  /** The screen's phosphor. Default `"p3"` (amber). */
  screen?: PhosphorName;
  /** Case colour in truecolor. Default `"#d8cdb1"`, an aged beige. */
  color?: AsciiColor;
  /** Seconds per typed character. Default 0.06. */
  typing?: number;
  /** Drag or use the arrow keys to turn it; it coasts after a drag. Default `true`. */
  interactive?: boolean;
  /** Cell height in CSS pixels. Default 11. */
  cell?: number;
  /** Time multiplier for the typing and the sway. Default 1. */
  speed?: number;
  /** `false` holds one still frame. Default `true`. */
  animate?: boolean;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

const DEFAULT_SCRIPT: readonly RetroCommand[] = [
  {
    command: "DIR /W",
    output: ["GLYPHS.BAS  FONT.CHR", "2 FILE(S)  41,216 FREE"],
  },
  {
    command: "TYPE README.TXT",
    output: ["EVERY PIXEL IS A LETTER."],
  },
  {
    command: "RUN GLYPHS.BAS",
    output: ["DRAWING 2,000 CELLS", "DONE IN 0.4 S"],
  },
  {
    command: "MEM",
    output: ["655,360 BYTES TOTAL", "601,248 BYTES FREE"],
  },
];

const DEFAULT_BANNER: readonly string[] = [
  "ASCIICN PC  BIOS 1.0",
  "640K MEMORY OK",
  "",
];

/* -------------------------------------------------------------------------- */
/* Look                                                                        */
/* -------------------------------------------------------------------------- */

const toBytes = ([r, g, b]: readonly number[]): Rgb8 => [
  Math.round((r ?? 0) * 255),
  Math.round((g ?? 0) * 255),
  Math.round((b ?? 0) * 255),
];

const lumaOf = (rgb: Rgb8) =>
  (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;

const rampStops = (ramp: AsciiLook["ramp"]): readonly string[] => {
  if (typeof ramp === "string") {
    return RAMPS[ramp as keyof typeof RAMPS] ?? RAMPS.sodium;
  }
  return ramp ?? RAMPS.sodium;
};

/**
 * Glyph options, ink and paper for a look. Truecolor and ansi16 cells are
 * recoloured afterwards from the lit samples only (see `colorCells`).
 */
// oxlint-disable-next-line complexity -- each look option adds a branch.
const computerLook = (
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
  const stops = rampStops(look.ramp);
  if (mode === "duotone") {
    paper = stops[0] ?? paper;
    palette = [hexToRgb(paper), themeInk];
  } else if (look.phosphor && mode === "mono") {
    const preset = PHOSPHORS[look.phosphor];
    ({ ink, paper } = preset);
    palette = [hexToRgb(preset.paper), hexToRgb(preset.ink)];
  }
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
    ramp: stops,
    threshold: look.threshold,
  };
  return {
    // The brightest ink of the mode, for text in duotone and palette.
    brightest:
      mode === "duotone"
        ? hexToRgb(stops.at(-1) ?? "#ffffff")
        : (palette.at(-1) ?? themeInk),
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
/* Model                                                                       */
/* -------------------------------------------------------------------------- */

type Vec3 = readonly [number, number, number];

/**
 * What a face is made of, which picks its texture.
 * - `case`: plain beige plastic.
 * - `unit`: the system unit's front, with drive bays, vents and a light.
 * - `bezel`: the monitor's front, with a hole for the screen and knobs.
 * - `recess`: the dark walls between the bezel and the glass.
 * - `screen`: the glass.
 * - `keys`: the keyboard's top.
 * - `vents`: a face cut with cooling slots.
 */
type Material =
  | "case"
  | "unit"
  | "bezel"
  | "recess"
  | "screen"
  | "keys"
  | "vents";

interface Face {
  /** Corners as seen from outside: top left, top right, bottom right, bottom left. */
  readonly corners: readonly [Vec3, Vec3, Vec3, Vec3];
  readonly material: Material;
  /** Outward normal, world space. */
  readonly normal: Vec3;
  /** Width and height in world units, so textures are drawn to scale. */
  readonly width: number;
  readonly height: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const face = (
  corners: readonly [Vec3, Vec3, Vec3, Vec3],
  material: Material
): Face => {
  const [tl, tr, , bl] = corners;
  const across = sub(tr, tl);
  const down = sub(bl, tl);
  // down x across points out of the face for corners in this order.
  const nx = down[1] * across[2] - down[2] * across[1];
  const ny = down[2] * across[0] - down[0] * across[2];
  const nz = down[0] * across[1] - down[1] * across[0];
  const length = Math.hypot(nx, ny, nz) || 1;
  return {
    corners,
    height: Math.hypot(...down),
    material,
    normal: [nx / length, ny / length, nz / length],
    width: Math.hypot(...across),
  };
};

type BoxMaterials = Partial<
  Record<"front" | "back" | "top" | "bottom" | "left" | "right", Material>
>;

/** An axis-aligned box; faces left out of `skip` are not built. */
const box = (
  [x0, y0, z0]: Vec3,
  [x1, y1, z1]: Vec3,
  materials: BoxMaterials = {},
  skip: readonly string[] = []
): Face[] => {
  const faces: Face[] = [];
  const add = (
    name: keyof BoxMaterials,
    corners: readonly [Vec3, Vec3, Vec3, Vec3]
  ) => {
    if (!skip.includes(name)) {
      faces.push(face(corners, materials[name] ?? "case"));
    }
  };
  add("front", [
    [x0, y1, z1],
    [x1, y1, z1],
    [x1, y0, z1],
    [x0, y0, z1],
  ]);
  add("back", [
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z0],
    [x1, y0, z0],
  ]);
  add("top", [
    [x0, y1, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x0, y1, z1],
  ]);
  add("bottom", [
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y0, z0],
    [x0, y0, z0],
  ]);
  add("right", [
    [x1, y1, z1],
    [x1, y1, z0],
    [x1, y0, z0],
    [x1, y0, z1],
  ]);
  add("left", [
    [x0, y1, z0],
    [x0, y1, z1],
    [x0, y0, z1],
    [x0, y0, z0],
  ]);
  return faces;
};

// The monitor's front, and the hole in it for the glass, in world units.
const BEZEL = { bottom: 0.66, left: -0.9, right: 0.9, top: 2.12, z: 0.52 };
const GLASS = {
  bottom: 0.98,
  inset: 0.05,
  left: -0.69,
  right: 0.69,
  top: 1.96,
};
// Rounded corners of the hole, like the curved tube behind it.
const GLASS_RADIUS = 0.1;
const KEYBOARD = { back: 1.06, front: 1.78, half: 1.02, high: 0.17, low: 0.07 };

/** The workstation: a desktop unit, a CRT on top and a keyboard in front. */
const buildModel = (): readonly Face[] => {
  const { left, right, top, bottom, z } = BEZEL;
  const faces: Face[] = [
    // System unit, lying flat.
    ...box(
      [-1.12, 0, -0.82],
      [1.12, 0.56, 0.86],
      { front: "unit", top: "case" },
      ["bottom"]
    ),
    // A short plinth under the monitor.
    ...box([-0.42, 0.56, -0.42], [0.42, 0.66, 0.3], {}, ["bottom"]),
    // The bezel: front with the hole, then its sides.
    ...box([left, bottom, 0.22], [right, top, z], { front: "bezel" }, ["back"]),
  ];
  // The tube's housing tapers back from the bezel.
  const front: readonly [Vec3, Vec3, Vec3, Vec3] = [
    [-0.84, 2.06, 0.22],
    [0.84, 2.06, 0.22],
    [0.84, 0.72, 0.22],
    [-0.84, 0.72, 0.22],
  ];
  const back: readonly [Vec3, Vec3, Vec3, Vec3] = [
    [-0.5, 1.78, -0.74],
    [0.5, 1.78, -0.74],
    [0.5, 0.86, -0.74],
    [-0.5, 0.86, -0.74],
  ];
  faces.push(
    face([back[0], back[1], front[1], front[0]], "vents"),
    face([front[1], back[1], back[2], front[2]], "case"),
    face([back[0], front[0], front[3], back[3]], "case"),
    face([front[3], front[2], back[2], back[3]], "case"),
    face([back[1], back[0], back[3], back[2]], "vents")
  );
  // The recess: four dark walls from the bezel to the glass.
  const g = GLASS;
  const zg = z - g.inset;
  faces.push(
    face(
      [
        [g.left, g.top, zg],
        [g.right, g.top, zg],
        [g.right, g.top, z],
        [g.left, g.top, z],
      ],
      "recess"
    ),
    face(
      [
        [g.left, g.bottom, z],
        [g.right, g.bottom, z],
        [g.right, g.bottom, zg],
        [g.left, g.bottom, zg],
      ],
      "recess"
    ),
    face(
      [
        [g.left, g.top, zg],
        [g.left, g.top, z],
        [g.left, g.bottom, z],
        [g.left, g.bottom, zg],
      ],
      "recess"
    ),
    face(
      [
        [g.right, g.top, z],
        [g.right, g.top, zg],
        [g.right, g.bottom, zg],
        [g.right, g.bottom, z],
      ],
      "recess"
    ),
    face(
      [
        [g.left, g.top, zg],
        [g.right, g.top, zg],
        [g.right, g.bottom, zg],
        [g.left, g.bottom, zg],
      ],
      "screen"
    )
  );
  // The keyboard: a wedge, higher at the back.
  const k = KEYBOARD;
  const bl: Vec3 = [-k.half, k.high, k.back];
  const br: Vec3 = [k.half, k.high, k.back];
  const fl: Vec3 = [-k.half, k.low, k.front];
  const fr: Vec3 = [k.half, k.low, k.front];
  faces.push(
    face([bl, br, fr, fl], "keys"),
    face([fl, fr, [k.half, 0, k.front], [-k.half, 0, k.front]], "case"),
    face([br, bl, [-k.half, 0, k.back], [k.half, 0, k.back]], "case"),
    face([fr, br, [k.half, 0, k.back], [k.half, 0, k.front]], "case"),
    face([bl, fl, [-k.half, 0, k.front], [-k.half, 0, k.back]], "case")
  );
  return faces;
};

const MODEL = buildModel();
const SCREEN_FACE = MODEL.findIndex((item) => item.material === "screen");

/* -------------------------------------------------------------------------- */
/* Textures                                                                    */
/* -------------------------------------------------------------------------- */

/** Light the panel's LED, the amber badge or nothing. */
const GLOW_NONE = 0;
const GLOW_LED = 1;
const GLOW_BADGE = 2;

interface Surface {
  /** Brightness of the paint, 0 to 1. */
  albedo: number;
  glow: number;
}

const inRect = (
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number
) => x >= left && x <= right && y >= top && y <= bottom;

/** Inside the rounded hole in the bezel, in the bezel's world units. */
const inGlass = (x: number, y: number) => {
  const cx = Math.min(
    Math.max(x, GLASS.left + GLASS_RADIUS),
    GLASS.right - GLASS_RADIUS
  );
  const cy = Math.min(
    Math.max(y, GLASS.bottom + GLASS_RADIUS),
    GLASS.top - GLASS_RADIUS
  );
  return Math.hypot(x - cx, y - cy) <= GLASS_RADIUS;
};

/** The system unit's front: drive bays on the right, vents and a light on the left. */
const unitFront = (x: number, y: number, out: Surface) => {
  for (const [top, bottom] of [
    [0.07, 0.25],
    [0.31, 0.49],
  ] as const) {
    if (inRect(x, y, 1.22, top, 2.06, bottom)) {
      const edge =
        x < 1.245 || x > 2.035 || y < top + 0.025 || y > bottom - 0.025;
      const middle = (top + bottom) / 2;
      const slot = Math.abs(y - middle) < 0.018 && x > 1.36 && x < 1.92;
      const latch = x > 1.94 && x < 2 && Math.abs(y - middle) < 0.05;
      out.albedo = edge || slot || latch ? 0.12 : 0.66;
      return;
    }
  }
  if (Math.hypot(x - 0.2, y - 0.4) < 0.035) {
    out.glow = GLOW_LED;
    return;
  }
  if (inRect(x, y, 0.12, 0.12, 0.5, 0.17)) {
    out.glow = GLOW_BADGE;
    return;
  }
  if (inRect(x, y, 0.62, 0.1, 1.08, 0.46) && (y - 0.1) % 0.07 < 0.026) {
    out.albedo = 0.16;
    return;
  }
  out.albedo = y > 0.51 ? 0.55 : 0.9;
};

/** The monitor's front: a bevel round the glass, knobs and a badge on the chin. */
const bezelFront = (x: number, y: number, out: Surface) => {
  // Back to world coordinates on the bezel, y up.
  const wx = BEZEL.left + x;
  const wy = BEZEL.top - y;
  const bevel = inRect(
    wx,
    wy,
    GLASS.left - 0.05,
    GLASS.bottom - 0.05,
    GLASS.right + 0.05,
    GLASS.top + 0.05
  );
  if (bevel) {
    // Lit from above, so the lower lip of the bevel is in shade.
    out.albedo = wy < GLASS.bottom ? 0.5 : 0.72;
    return;
  }
  if (
    Math.hypot(wx - 0.52, wy - 0.82) < 0.045 ||
    Math.hypot(wx - 0.66, wy - 0.82) < 0.045
  ) {
    out.albedo = 0.18;
    return;
  }
  if (Math.hypot(wx - 0.8, wy - 0.82) < 0.025) {
    out.glow = GLOW_LED;
    return;
  }
  if (inRect(wx, wy, -0.68, 0.79, -0.36, 0.84)) {
    out.glow = GLOW_BADGE;
    return;
  }
  out.albedo = 0.92;
};

const KEY_ROWS = 5;
const KEY_COLUMNS = 15;

/**
 * Which key is under a point on the keyboard's top, as `row * 16 + column`,
 * or -1 in a gap. The bottom row has a long space bar.
 */
const keyAt = (x: number, y: number, width: number, height: number) => {
  const margin = 0.07;
  const u = (x - margin) / (width - margin * 2);
  const v = (y - margin) / (height - margin * 2);
  if (u < 0 || u >= 1 || v < 0 || v >= 1) {
    return -1;
  }
  const row = Math.floor(v * KEY_ROWS);
  const fu = u * KEY_COLUMNS;
  const fv = v * KEY_ROWS;
  // Keys are 80% of their pitch across and 74% down.
  if (fu - Math.floor(fu) > 0.8 || fv - row > 0.74) {
    return -1;
  }
  const column = Math.floor(fu);
  if (row === KEY_ROWS - 1 && column >= 4 && column <= 10) {
    // The space bar spans the gaps between its columns too.
    return row * 16 + 4;
  }
  return row * 16 + column;
};

const texture = (
  item: Face,
  u: number,
  v: number,
  pressed: number,
  out: Surface
) => {
  out.albedo = 0.88;
  out.glow = GLOW_NONE;
  const x = u * item.width;
  const y = v * item.height;
  switch (item.material) {
    case "unit": {
      unitFront(x, y, out);
      return;
    }
    case "bezel": {
      bezelFront(x, y, out);
      return;
    }
    case "recess": {
      out.albedo = 0.1;
      return;
    }
    case "screen": {
      out.albedo = 0;
      return;
    }
    case "keys": {
      const key = keyAt(x, y, item.width, item.height);
      if (key < 0) {
        out.albedo = 0.2;
      } else {
        out.albedo = key === pressed ? 0.45 : 0.96;
      }
      return;
    }
    case "vents": {
      const slot = u > 0.15 && u < 0.85 && (u * 24) % 1 < 0.42;
      out.albedo = slot && v > 0.2 && v < 0.8 ? 0.22 : 0.84;
      return;
    }
    case "case": {
      return;
    }
    default: {
      const exhaustive: never = item.material;
      return exhaustive;
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Camera and raster                                                           */
/* -------------------------------------------------------------------------- */

// Distance from the camera to the model's centre, and that centre.
const CAMERA = 8.5;
const CENTRE: Vec3 = [0, 0.98, 0.42];

interface View {
  readonly yaw: number;
  readonly pitch: number;
  readonly cx: number;
  readonly cy: number;
  /** One world unit at the centre plane, in sample rows. */
  readonly unit: number;
  /** Sample width over sample height. */
  readonly aspect: number;
}

/** World point to screen x, y (samples) and depth. */
const project = (view: View, [px, py, pz]: Vec3, out: Float64Array) => {
  const x = px - CENTRE[0];
  const y = py - CENTRE[1];
  const z = pz - CENTRE[2];
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  const y2 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  const depth = CAMERA - z2;
  const f = CAMERA / depth;
  out[0] = view.cx + (x1 * f * view.unit) / view.aspect;
  out[1] = view.cy - y2 * f * view.unit;
  out[2] = depth;
};

// The resting three-quarter view, and how far the idle sway goes.
const BASE_YAW = -0.48;
const BASE_PITCH = 0.3;
const SWAY = 0.12;

/**
 * Scale and centre so the whole model fits the box with a margin, at
 * either end of the idle sway.
 */
const fitView = (width: number, height: number, aspect: number) => {
  const point = new Float64Array(3);
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const yaw of [BASE_YAW - SWAY, BASE_YAW + SWAY]) {
    const view: View = {
      aspect: 1,
      cx: 0,
      cy: 0,
      pitch: BASE_PITCH,
      unit: 1,
      yaw,
    };
    for (const item of MODEL) {
      for (const corner of item.corners) {
        project(view, corner, point);
        left = Math.min(left, point[0] ?? 0);
        right = Math.max(right, point[0] ?? 0);
        top = Math.min(top, point[1] ?? 0);
        bottom = Math.max(bottom, point[1] ?? 0);
      }
    }
  }
  const margin = 0.9;
  const unit = Math.min(
    (height * margin) / (bottom - top),
    (width * aspect * margin) / (right - left)
  );
  return {
    aspect,
    cx: width / 2 - (((left + right) / 2) * unit) / aspect,
    cy: height / 2 - ((top + bottom) / 2) * unit,
    unit,
  };
};

/** A world direction into view space (z toward the viewer). */
const rotateNormal = (view: View, [x, y, z]: Vec3): Vec3 => {
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
};

interface Buffers {
  readonly key: string;
  readonly field: ToneField;
  readonly depth: Float32Array;
  /** Which face covers each sample, or -1. */
  readonly faceAt: Int16Array;
  /** Perspective-correct texture coordinates on that face. */
  readonly u: Float32Array;
  readonly v: Float32Array;
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
    depth: new Float32Array(size),
    faceAt: new Int16Array(size),
    field,
    key,
    rgb: new Uint8ClampedArray(size * 3),
    u: new Float32Array(size),
    v: new Float32Array(size),
  };
};

// Per-corner texture coordinates: top left, top right, bottom right, bottom left.
const CORNER_UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

/**
 * Fill one triangle of a face. Texture coordinates are interpolated over
 * depth so they stay put under perspective, and the bezel's hole is cut
 * out here, so the glass behind it shows through.
 */
// oxlint-disable-next-line complexity -- one tight loop over the triangle's samples.
const rasterTriangle = (
  buffers: Buffers,
  screen: Float64Array,
  index: number,
  corners: readonly [number, number, number]
) => {
  const { field, depth, faceAt } = buffers;
  const { width, height } = field;
  const [ia, ib, ic] = corners;
  const ax = screen[ia * 3] ?? 0;
  const ay = screen[ia * 3 + 1] ?? 0;
  const bx = screen[ib * 3] ?? 0;
  const by = screen[ib * 3 + 1] ?? 0;
  const cx = screen[ic * 3] ?? 0;
  const cy = screen[ic * 3 + 1] ?? 0;
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-6) {
    return;
  }
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
  if (minX > maxX || minY > maxY) {
    return;
  }
  const inverse = 1 / area;
  const wa = 1 / (screen[ia * 3 + 2] ?? 1);
  const wb = 1 / (screen[ib * 3 + 2] ?? 1);
  const wc = 1 / (screen[ic * 3 + 2] ?? 1);
  const [ua, va] = CORNER_UV[ia] ?? [0, 0];
  const [ub, vb] = CORNER_UV[ib] ?? [0, 0];
  const [uc, vc] = CORNER_UV[ic] ?? [0, 0];
  const item = MODEL[index];
  const cut = item?.material === "bezel";
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
      const w = w0 * wa + w1 * wb + w2 * wc;
      const z = 1 / w;
      const at = y * width + x;
      if (z >= (depth[at] ?? 0)) {
        continue;
      }
      const u = (w0 * ua * wa + w1 * ub * wb + w2 * uc * wc) * z;
      const v = (w0 * va * wa + w1 * vb * wb + w2 * vc * wc) * z;
      if (
        cut &&
        item &&
        inGlass(BEZEL.left + u * item.width, BEZEL.top - v * item.height)
      ) {
        continue;
      }
      depth[at] = z;
      faceAt[at] = index;
      buffers.u[at] = u;
      buffers.v[at] = v;
    }
  }
};

const rasterModel = (buffers: Buffers, view: View) => {
  const screen = new Float64Array(12);
  const point = new Float64Array(3);
  for (const [index, item] of MODEL.entries()) {
    for (const [corner, position] of item.corners.entries()) {
      project(view, position, point);
      screen.set(point, corner * 3);
    }
    // Both triangles keep the corner numbering, which indexes CORNER_UV.
    rasterTriangle(buffers, screen, index, [0, 1, 2]);
    rasterTriangle(buffers, screen, index, [0, 2, 3]);
  }
};

/* -------------------------------------------------------------------------- */
/* Shading                                                                     */
/* -------------------------------------------------------------------------- */

const LIGHT: Vec3 = (() => {
  const length = Math.hypot(-0.55, 0.85, 0.7);
  return [-0.55 / length, 0.85 / length, 0.7 / length];
})();

const LED: Rgb8 = [90, 255, 120];
const RECESS: Rgb8 = [40, 34, 30];

interface Palette {
  readonly body: Rgb8;
  readonly badge: Rgb8;
  readonly glass: Rgb8;
  /** Raise lit tones for Braille and quadrants, which drop tones under half. */
  readonly packed: boolean;
}

/**
 * Light every covered sample from its face's normal and paint. Face
 * normals are flat, so each side of the case gets one tone and the box
 * reads as a solid. Where two faces meet, the sample on the far side of
 * the crease is left empty: a thin outline that keeps every edge crisp.
 */
// oxlint-disable-next-line complexity -- one pass over every sample, material by material.
const shadeModel = (
  buffers: Buffers,
  normals: readonly Vec3[],
  pressed: number,
  palette: Palette
) => {
  const { field, faceAt, rgb, u, v } = buffers;
  const { width, height, tones } = field;
  const surface: Surface = { albedo: 0, glow: GLOW_NONE };
  const lift = palette.packed ? 0.18 : 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      const index = faceAt[at] ?? -1;
      const item = MODEL[index];
      if (!item) {
        tones[at] = 0;
        continue;
      }
      const right = x + 1 < width ? (faceAt[at + 1] ?? -1) : index;
      const below = y + 1 < height ? (faceAt[at + width] ?? -1) : index;
      if ((right !== index && right >= 0) || (below !== index && below >= 0)) {
        tones[at] = 0;
        continue;
      }
      texture(item, u[at] ?? 0, v[at] ?? 0, pressed, surface);
      const p = at * 3;
      if (item.material === "screen") {
        // Dark glass with a soft glare in the upper left, so it reads as
        // a curved tube even before the text shows.
        const gu = (u[at] ?? 0) - 0.2;
        const gv = (v[at] ?? 0) - 0.18;
        const glare = Math.exp(-(gu * gu * 9 + gv * gv * 22)) * 0.2;
        tones[at] = glare;
        rgb.set(palette.glass, p);
        continue;
      }
      if (surface.glow !== GLOW_NONE) {
        const color = surface.glow === GLOW_LED ? LED : palette.badge;
        tones[at] = 1;
        rgb.set(color, p);
        continue;
      }
      const [nx, ny, nz] = normals[index] ?? LIGHT;
      const diffuse = Math.max(
        0,
        nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
      );
      const light = 0.2 + 0.8 * diffuse;
      const tone = surface.albedo * light;
      tones[at] = tone > 0 ? lift + (1 - lift) * tone : 0;
      const base = item.material === "recess" ? RECESS : palette.body;
      // Colour carries less shading than tone: density already darkens.
      const shade = 0.35 + 0.65 * light * (0.4 + 0.6 * surface.albedo);
      rgb[p] = base[0] * shade;
      rgb[p + 1] = base[1] * shade;
      rgb[p + 2] = base[2] * shade;
    }
  }
};

/** Cap the luma on light paper, then snap to the ANSI table if there is one. */
const finishColor = (
  color: Rgb8,
  ansi: readonly Rgb8[] | null,
  lumaLimit: number
): Rgb8 => {
  let out = color;
  const value = lumaOf(out);
  if (value > lumaLimit) {
    // On a light page, near-white glyphs vanish into the paper.
    const scale = lumaLimit / value;
    out = [out[0] * scale, out[1] * scale, out[2] * scale];
  }
  return ansi ? (ansi[nearestIndex(out, ansi)] ?? out) : out;
};

/**
 * Colour every inked cell from its lit samples, weighted by tone, so a
 * thin Braille edge keeps its full colour.
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
      const color = finishColor(
        gradeRgb([r / weight, g / weight, b / weight], grade),
        ansi,
        lumaLimit
      );
      colors.set([color[0], color[1], color[2], 255], cell * 4);
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Terminal                                                                    */
/* -------------------------------------------------------------------------- */

const LINE_DELAY = 0.16;
const PAUSE = 1.4;

interface Session {
  readonly lines: readonly string[];
  /** The command being typed, without the prompt. */
  readonly typing: string;
  /** Characters typed so far over the whole loop, to pick a key to press. */
  readonly keystroke: number;
}

/**
 * The screen at `time`: the banner, every finished command and its
 * output, then whatever is being typed. Loops through the script.
 */
const sessionAt = (
  time: number,
  script: readonly RetroCommand[],
  banner: readonly string[],
  prompt: string,
  rate: number
): Session => {
  const lines = [...banner];
  if (script.length === 0) {
    return { keystroke: 0, lines, typing: "" };
  }
  const duration = (entry: RetroCommand) =>
    entry.command.length * rate +
    0.4 +
    entry.output.length * LINE_DELAY +
    PAUSE;
  const cycle = script.reduce((sum, entry) => sum + duration(entry), 0);
  let left = ((time % cycle) + cycle) % cycle;
  let keystroke = 0;
  for (const entry of script) {
    const length = duration(entry);
    if (left >= length) {
      lines.push(`${prompt}${entry.command}`, ...entry.output, "");
      left -= length;
      keystroke += entry.command.length;
      continue;
    }
    const typed = Math.floor(left / rate);
    if (typed < entry.command.length) {
      return {
        keystroke: keystroke + typed,
        lines,
        typing: entry.command.slice(0, typed),
      };
    }
    lines.push(`${prompt}${entry.command}`);
    const shown = Math.floor(
      (left - entry.command.length * rate - 0.4) / LINE_DELAY
    );
    lines.push(...entry.output.slice(0, Math.max(0, shown)));
    return { keystroke: -1, lines, typing: "" };
  }
  return { keystroke: -1, lines, typing: "" };
};

interface TextLayout {
  readonly columns: number;
  readonly rows: number;
}

/** A point on the glass at (u, v), through a slight barrel like a curved tube. */
const glassPoint = (u: number, v: number): Vec3 => {
  const du = u - 0.5;
  const dv = v - 0.5;
  const bulge = 1 + 0.05 * (du * du + dv * dv);
  const bu = 0.5 + du * bulge;
  const bv = 0.5 + dv * bulge;
  return [
    GLASS.left + (GLASS.right - GLASS.left) * bu,
    GLASS.top - (GLASS.top - GLASS.bottom) * bv,
    BEZEL.z - GLASS.inset,
  ];
};

// The text area inside the glass, as a share of it on each side.
const TEXT_MARGIN = 0.07;

/**
 * How many characters fit on the glass, measured at the most turned pose
 * the sway reaches, so a row never needs more cells than it has and no
 * character is ever dropped.
 */
const textLayout = (view: View, gx: number, gy: number): TextLayout => {
  const a = new Float64Array(3);
  const b = new Float64Array(3);
  const c = new Float64Array(3);
  project(view, glassPoint(0, 0.5), a);
  project(view, glassPoint(1, 0.5), b);
  const width = Math.abs((b[0] ?? 0) - (a[0] ?? 0)) / gx;
  project(view, glassPoint(0.5, 0), a);
  project(view, glassPoint(0.5, 1), c);
  const height = Math.abs((c[1] ?? 0) - (a[1] ?? 0)) / gy;
  const fill = 1 - TEXT_MARGIN * 2;
  return {
    columns: Math.max(8, Math.min(64, Math.floor(width * fill * 0.94))),
    rows: Math.max(3, Math.min(24, Math.floor(height * fill * 0.96))),
  };
};

/**
 * Type the session onto the glass, as real glyphs over the shaded scene.
 * Each line starts where the glass's left margin projects and sits on the
 * cell row its middle projects to, then runs one cell per character:
 * slanting text across cell rows would break it apart, while this keeps
 * every line straight and readable as the monitor turns.
 */
const drawText = (
  frame: MutableFrame,
  buffers: Buffers,
  view: View,
  layout: TextLayout,
  session: Session,
  prompt: string,
  { color, cursor }: { color: Rgb8; cursor: boolean },
  [gx, gy]: readonly [number, number]
) => {
  const { field, faceAt } = buffers;
  // Long lines wrap at the screen's edge, as a terminal would.
  const lines = [...session.lines, `${prompt}${session.typing}`].flatMap(
    (line) => {
      const glyphs = [...line];
      if (glyphs.length <= layout.columns) {
        return [line];
      }
      const wrapped: string[] = [];
      for (let at = 0; at < glyphs.length; at += layout.columns) {
        wrapped.push(glyphs.slice(at, at + layout.columns).join(""));
      }
      return wrapped;
    }
  );
  const visible = lines.slice(-layout.rows);
  const point = new Float64Array(3);
  const fill = 1 - TEXT_MARGIN * 2;
  // Rows stack one cell apart from the first row's projected cell row, and
  // every line starts in the same column, the innermost of the margin's
  // ends: rounding each row on its own would skip or share cell rows.
  const topRow = TEXT_MARGIN + (0.5 / layout.rows) * fill;
  const bottomRow = TEXT_MARGIN + ((layout.rows - 0.5) / layout.rows) * fill;
  project(view, glassPoint(0.5, topRow), point);
  const y0 = Math.floor((point[1] ?? 0) / gy);
  project(view, glassPoint(TEXT_MARGIN, topRow), point);
  let x0 = Math.round((point[0] ?? 0) / gx);
  project(view, glassPoint(TEXT_MARGIN, bottomRow), point);
  x0 = Math.max(x0, Math.round((point[0] ?? 0) / gx));
  const put = (column: number, row: number, glyph: string) => {
    const y = y0 + row;
    const x = x0 + column;
    // Only on glass that is in view: the bezel may hide an edge.
    const sx = x * gx + Math.floor(gx / 2);
    const sy = y * gy + Math.floor(gy / 2);
    if (
      sx < 0 ||
      sy < 0 ||
      sx >= field.width ||
      sy >= field.height ||
      faceAt[sy * field.width + sx] !== SCREEN_FACE
    ) {
      return;
    }
    frame.put(x, y, glyph, color);
  };
  for (const [row, text] of visible.entries()) {
    let column = 0;
    for (const glyph of text) {
      if (column >= layout.columns) {
        break;
      }
      if (glyph !== " ") {
        put(column, row, glyph);
      }
      column += 1;
    }
  }
  if (cursor) {
    const last = visible.length - 1;
    const at = [...(visible[last] ?? "")].length;
    if (at < layout.columns) {
      put(at, last, "█");
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Drag to turn                                                                */
/* -------------------------------------------------------------------------- */

interface Turn {
  /** Yaw and pitch added by dragging. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  dragging: boolean;
}

const useDragTurn = (
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
      turn.current.vx = 0;
      turn.current.vy = 0;
      last = { t: event.timeStamp, x: event.clientX, y: event.clientY };
      root.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!turn.current.dragging) {
        return;
      }
      const size = Math.max(120, Math.min(root.clientWidth, root.clientHeight));
      const dx = ((event.clientX - last.x) / size) * Math.PI * 0.8;
      const dy = ((event.clientY - last.y) / size) * Math.PI * 0.8;
      const dt = Math.max(1, event.timeStamp - last.t) / 1000;
      turn.current.x += dx;
      turn.current.y += dy;
      turn.current.vx = dx / dt;
      turn.current.vy = dy / dt;
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

const KEYS: Partial<Record<string, readonly [number, number]>> = {
  ArrowDown: [0, 0.12],
  ArrowLeft: [-0.15, 0],
  ArrowRight: [0.15, 0],
  ArrowUp: [0, -0.12],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A vintage workstation drawn in glyphs on the CPU: a CRT monitor on a
 * desktop unit with drive bays, and a keyboard in front, seen in three
 * quarters. Flat-shaded faces give each side of the case its own glyph
 * density, and a thin gap traces every edge. The glass shows a live
 * session typed in real characters, placed where they fall on the tube,
 * with keys dipping on the keyboard as it types.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const RetroComputer = ({
  script = DEFAULT_SCRIPT,
  prompt = "C:\\>",
  banner = DEFAULT_BANNER,
  screen = "p3",
  color = "#d8cdb1",
  typing = 0.06,
  interactive = true,
  cell = 11,
  speed = 1,
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
}: RetroComputerProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useAsciiColors(rootRef, [
    "--ascii-ink",
    "--ascii-paper",
    color,
  ]);
  const reducedMotion = usePrefersReducedMotion();
  const turnRef = useRef<Turn>({ dragging: false, vx: 0, vy: 0, x: 0, y: 0 });
  useDragTurn(rootRef, turnRef, interactive);
  const buffersRef = useRef<Buffers | null>(null);

  const resolved = resolveCharset(charset, chars);
  const look = computerLook(
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
  const body = theme?.[2] ? toBytes(theme[2]) : hexToRgb("#d8cdb1");
  const glass = PHOSPHORS[screen];
  const ansiTable = look.mode === "ansi16" ? ANSI16[ansi ?? "vga"] : null;
  const sampled = look.mode === "truecolor" || look.mode === "ansi16";
  const textColor = finishColor(
    sampled ? hexToRgb(glass.ink) : look.brightest,
    ansiTable,
    look.lumaLimit
  );
  const rate = Math.max(0.01, typing);

  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    delta,
    time,
  }: AsciiGridDrawContext) => {
    const turn = turnRef.current;
    if (delta > 0 && !turn.dragging) {
      // Coast after a drag, then come to rest where it was left.
      turn.x += turn.vx * delta;
      turn.y += turn.vy * delta;
      const fade = Math.exp(-delta * 2);
      turn.vx *= fade;
      turn.vy *= fade;
    }
    turn.x = clamp(turn.x, -0.75, 0.75);
    turn.y = clamp(turn.y, -0.3, 0.35);

    const [gx, gy] = resolved.grid;
    const key = `${columns}x${rows}x${gx}x${gy}`;
    if (buffersRef.current?.key !== key) {
      buffersRef.current = createBuffers(columns, rows, resolved, key);
    }
    const buffers = buffersRef.current;
    const { field } = buffers;
    buffers.depth.fill(Number.POSITIVE_INFINITY);
    buffers.faceAt.fill(-1);

    const aspect = metrics.width / gx / (metrics.height / gy);
    const frameView = fitView(field.width, field.height, aspect);
    const still = delta === 0 && (!animate || reducedMotion);
    const sway = still ? 0 : Math.sin(time * 0.31) * SWAY;
    const view: View = {
      ...frameView,
      pitch: BASE_PITCH + turn.y + (still ? 0 : Math.sin(time * 0.23) * 0.03),
      yaw: BASE_YAW + turn.x + sway,
    };
    // The text grid comes from the most turned pose of the idle sway.
    const layout = textLayout(
      { ...frameView, pitch: BASE_PITCH, yaw: BASE_YAW - SWAY },
      gx,
      gy
    );

    const session = sessionAt(time, script, banner, prompt, rate);
    // The key under the last typed character dips for a moment.
    const stroke = session.keystroke;
    const pressed =
      stroke >= 0 && (time / rate) % 1 < 0.6
        ? ((stroke * 7) % (KEY_ROWS - 1)) * 16 + ((stroke * 37) % KEY_COLUMNS)
        : -1;

    rasterModel(buffers, view);
    shadeModel(
      buffers,
      MODEL.map((item) => rotateNormal(view, item.normal)),
      pressed,
      {
        badge: [255, 176, 64],
        body,
        glass: hexToRgb(glass.paper),
        packed: look.packed,
      }
    );
    mapTones(field, columns, rows, look.options, frame);
    if (sampled) {
      colorCells(buffers, resolved, frame, {
        ansi: ansiTable,
        grade,
        lumaLimit: look.lumaLimit,
      });
    }
    drawText(
      frame,
      buffers,
      view,
      layout,
      session,
      prompt,
      {
        color: textColor,
        cursor: Math.floor(time * 1.8) % 2 === 0 || session.typing !== "",
      },
      [gx, gy]
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEYS[event.key];
    if (!(interactive && step)) {
      return;
    }
    event.preventDefault();
    turnRef.current.x += step[0];
    turnRef.current.y += step[1];
  };

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={
        ariaLabel ??
        (interactive
          ? "A vintage computer drawn in glyphs, typing on its screen. Drag it or use the arrow keys to turn it."
          : "A vintage computer drawn in glyphs, typing on its screen.")
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
        speed={speed}
        animate={animate}
        fps={30}
        stillTime={9}
        handle={handle}
        className="absolute inset-0"
      />
      {fx ? <CrtOverlay fx={fx} /> : null}
    </div>
  );
};
