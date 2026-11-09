import {
  ANSI16,
  CHARSET_NAMES,
  CHARSETS,
  CRT_FX,
  NO_FX,
  PHOSPHORS,
  RAMPS,
  rgbToHex,
} from "@/lib/ascii";
import type {
  AsciiLook,
  CharsetName,
  PhosphorName,
  PostFx,
  RampName,
} from "@/lib/ascii";

/**
 * The switches a stage exposes, and how each becomes `AsciiLook` props.
 * Shared by the stage and its controls on /backgrounds.
 */

/** One glyph per charset that shows what it draws, for the switcher buttons. */
export const CHARSET_SIGNS = {
  blocks: "▓",
  braille: "⣿",
  cp437: "☻",
  dense: "$",
  dots: "●",
  edge: "/",
  katakana: "ﾂ",
  petscii: "◆",
  quadrants: "▟",
  standard: "@",
} as const satisfies Record<CharsetName, string>;

export const CHARSET_OPTIONS = CHARSET_NAMES.map((id) => ({
  id,
  label: CHARSETS[id].label,
  sign: CHARSET_SIGNS[id],
}));

export const isCharsetName = (value: string): value is CharsetName =>
  Object.hasOwn(CHARSETS, value);

/**
 * A colour treatment. `ink` follows the site palette; phosphors are mono
 * CRT presets; ramps read the tone through a duotone ramp; `truecolor` and
 * `ansi16` keep the source's own colours.
 */
export type ColorLook =
  | { readonly kind: "ink" }
  | { readonly kind: "phosphor"; readonly phosphor: PhosphorName }
  | { readonly kind: "ramp"; readonly ramp: RampName }
  | { readonly kind: "truecolor" }
  | { readonly kind: "ansi16" };

export interface ColorOption {
  readonly id: string;
  readonly label: string;
  readonly look: ColorLook;
  /** CSS background for the swatch. */
  readonly swatch: string;
}

const rampGradient = (ramp: RampName) =>
  `linear-gradient(90deg, ${RAMPS[ramp].join(", ")})`;

const VGA_SWATCH = `conic-gradient(${ANSI16.vga
  .slice(8)
  .map((rgb) => rgbToHex(rgb))
  .join(", ")})`;

export const COLOR_OPTIONS: readonly ColorOption[] = [
  {
    id: "ink",
    label: "Site ink",
    look: { kind: "ink" },
    swatch: "var(--ascii-ink)",
  },
  ...(["p1", "p3", "ibm", "blueprint"] as const).map((phosphor) => ({
    id: phosphor,
    label: PHOSPHORS[phosphor].label,
    look: { kind: "phosphor", phosphor } as const,
    swatch: PHOSPHORS[phosphor].ink,
  })),
  ...(["outrun", "ember", "glacier", "vapor"] as const).map((ramp) => ({
    id: ramp,
    label: `${ramp.charAt(0).toUpperCase()}${ramp.slice(1)} ramp`,
    look: { kind: "ramp", ramp } as const,
    swatch: rampGradient(ramp),
  })),
  {
    id: "truecolor",
    label: "Truecolor",
    look: { kind: "truecolor" },
    swatch:
      "conic-gradient(oklch(0.75 0.17 30), oklch(0.8 0.16 100), oklch(0.78 0.15 160), oklch(0.72 0.14 240), oklch(0.7 0.2 320), oklch(0.75 0.17 30))",
  },
  {
    id: "ansi16",
    label: "ANSI 16 (VGA)",
    look: { kind: "ansi16" },
    swatch: VGA_SWATCH,
  },
];

export const findColor = (id: string | null | undefined) =>
  COLOR_OPTIONS.find((option) => option.id === id);

/** The look props for a colour treatment. */
export const colorProps = (look: ColorLook): AsciiLook => {
  switch (look.kind) {
    case "ink": {
      return { colorMode: "mono" };
    }
    case "phosphor": {
      return { colorMode: "mono", phosphor: look.phosphor };
    }
    case "ramp": {
      return { colorMode: "duotone", ramp: look.ramp };
    }
    case "truecolor": {
      return { colorMode: "truecolor" };
    }
    case "ansi16": {
      return { ansi: "vga", colorMode: "ansi16" };
    }
    default: {
      const exhaustive: never = look;
      return exhaustive;
    }
  }
};

/** Glyph cell sizes the stage offers, in CSS px. The backgrounds draw square cells, 7px by default. */
export const CELL_SIZES = [5, 7, 10, 14] as const;
export type CellSize = (typeof CELL_SIZES)[number];

export const isCellSize = (value: number): value is CellSize =>
  CELL_SIZES.some((size) => size === value);

/** The CRT switches on /backgrounds, each a slice of the full CRT look. */
export const FX_SWITCHES = [
  "scanlines",
  "bloom",
  "curvature",
  "vignette",
  "flicker",
  "glitch",
] as const satisfies readonly (keyof PostFx)[];
export type FxSwitch = (typeof FX_SWITCHES)[number];

// Glitch is off in the full CRT look; this is the strength its switch uses.
const FX_ON: Required<PostFx> = { ...CRT_FX, glitch: 0.25 };

export const fxProps = (on: ReadonlySet<FxSwitch>): PostFx | undefined => {
  if (on.size === 0) {
    return undefined;
  }
  const fx: Required<PostFx> = { ...NO_FX };
  for (const name of on) {
    fx[name] = FX_ON[name];
  }
  return fx;
};

/**
 * Everything one stage can switch. `null` charset or colour means the
 * component's own default, which is what a fresh install draws.
 */
export interface StageSettings {
  readonly sourceId: string;
  readonly charset: CharsetName | null;
  readonly colorId: string | null;
  readonly cell: CellSize;
  readonly fx: ReadonlySet<FxSwitch>;
}

export const lookProps = (settings: StageSettings): AsciiLook => {
  const color = findColor(settings.colorId);
  return {
    ...(settings.charset ? { charset: settings.charset } : {}),
    ...(color ? colorProps(color.look) : {}),
    ...(settings.fx.size > 0 ? { fx: fxProps(settings.fx) } : {}),
  };
};
