/**
 * The Studio's state model and its URL form. Pure and server-safe: the
 * route parses `searchParams` with it on the server, so the first render
 * already shows the shared setup and hydration never disagrees.
 *
 * A setup is a source plus the settings the user changed. Each source
 * brings its own defaults (Matrix wants katakana, photos want Classic), so
 * the URL and the JSX export only carry real choices, and switching source
 * keeps them.
 */

import { z } from "zod";

import { SOURCE_IDS } from "@/components/studio/source-ids";
import type { SourceId } from "@/components/studio/source-ids";
import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import type { CharsetName } from "@/lib/ascii/charsets";
import { INTERACTIONS, NO_FX } from "@/lib/ascii/look";
import type { Interaction, PostFx } from "@/lib/ascii/look";
import { DITHER_MATRICES } from "@/lib/ascii/matrices";
import type { DitherMatrix } from "@/lib/ascii/matrices";
import { PHOSPHOR_NAMES, RAMP_NAMES } from "@/lib/ascii/palettes";
import type { Ansi16Name, PhosphorName, RampName } from "@/lib/ascii/palettes";

/** Charset picker value: a named set, or the custom ramp in `chars`. */
export type StudioCharset = CharsetName | "custom";

/**
 * Colour modes the Studio offers. `native` is the source's own palette
 * (the engine's `palette` mode), which only GPU sources have.
 */
export const STUDIO_COLOR_MODES = [
  "native",
  "mono",
  "truecolor",
  "ansi16",
  "duotone",
] as const;
export type StudioColorMode = (typeof STUDIO_COLOR_MODES)[number];

/** Mono ink: the site palette, a phosphor preset, or a custom `#rrggbb`. */
export type MonoInk = "theme" | PhosphorName | `#${string}`;

export const FX_KEYS = [
  "scanlines",
  "bloom",
  "curvature",
  "glitch",
  "flicker",
  "vignette",
] as const satisfies readonly (keyof PostFx)[];
export type FxKey = (typeof FX_KEYS)[number];
export type FxSettings = Readonly<Record<FxKey, number>>;

export const DITHER_OPTIONS = ["none", ...DITHER_MATRICES] as const;
export type DitherOption = "none" | DitherMatrix;

/** Every setting a control can change. */
export interface Look {
  readonly charset: StudioCharset;
  /** The custom ramp, empty to dense. Used when `charset` is `custom`. */
  readonly chars: string;
  /** Glyph cell height in CSS px, 4 to 28. */
  readonly cell: number;
  readonly brightness: number;
  readonly contrast: number;
  readonly gamma: number;
  readonly saturation: number;
  readonly dither: DitherOption;
  readonly invert: boolean;
  readonly edgeThreshold: number;
  readonly colorMode: StudioColorMode;
  readonly ink: MonoInk;
  readonly ansi: Ansi16Name;
  readonly ramp: RampName;
  readonly background: "paper" | "transparent";
  readonly fx: FxSettings;
  readonly interaction: Interaction;
  readonly speed: number;
}

export type LookKey = keyof Look;
export type LookOverrides = Partial<Look>;

/** What every source starts from before its own defaults. */
export const BASE_LOOK: Look = {
  ansi: "vga",
  background: "paper",
  brightness: 0,
  cell: 12,
  chars: "",
  charset: "standard",
  colorMode: "mono",
  contrast: 1,
  dither: "none",
  edgeThreshold: 0.22,
  fx: NO_FX,
  gamma: 1,
  ink: "theme",
  interaction: "none",
  invert: false,
  ramp: "mainframe",
  saturation: 1,
  speed: 1,
};

export const CELL_RANGE = { max: 28, min: 4 } as const;

/** Image presets shipped in `public/examples`. */
export const IMAGE_PRESETS = [
  { id: "earthrise", label: "Earthrise", src: "/examples/earthrise.jpg" },
  { id: "aldrin", label: "Aldrin", src: "/examples/aldrin.jpg" },
  { id: "pillars", label: "Pillars", src: "/examples/pillars.jpg" },
  { id: "tetons", label: "Tetons", src: "/examples/tetons.jpg" },
] as const;
export type ImagePresetId = (typeof IMAGE_PRESETS)[number]["id"];

export const TEXT_FONTS = ["mono", "sans", "serif"] as const;
export type TextFont = (typeof TEXT_FONTS)[number];

/**
 * Inputs for the sources that take one: the seed of a seeded background
 * and the media sources' settings. Files and streams never enter the URL.
 */
export interface MediaSettings {
  /** Seeded backgrounds: any string. Empty uses the component's own. */
  readonly seed: string;
  /** Image and video: stretch tones to use the whole ramp. */
  readonly levels: boolean;
  readonly image: ImagePresetId;
  /** A video URL the user typed, http(s) only. Empty for none. */
  readonly video: string;
  readonly text: string;
  readonly weight: number;
  readonly font: TextFont;
}

export const BASE_MEDIA: MediaSettings = {
  font: "sans",
  image: "earthrise",
  levels: true,
  seed: "",
  text: "asciicn",
  video: "",
  weight: 800,
};

export interface StudioState {
  readonly source: SourceId;
  readonly overrides: LookOverrides;
  readonly media: MediaSettings;
}

export const DEFAULT_SOURCE: SourceId = "nebula";

/** The longest custom ramp the Studio accepts, in glyphs. */
export const MAX_RAMP = 96;

export type RampCheck =
  | { readonly kind: "ok"; readonly glyphs: number }
  | { readonly kind: "error"; readonly message: string };

/** Whether `chars` can be a ramp: two to 96 glyphs, no line breaks. */
export const checkRamp = (chars: string): RampCheck => {
  const glyphs = [...chars];
  if (glyphs.some((glyph) => glyph === "\n" || glyph === "\t")) {
    return { kind: "error", message: "No tabs or line breaks." };
  }
  if (glyphs.length < 2) {
    return { kind: "error", message: "A ramp needs at least two glyphs." };
  }
  if (glyphs.length > MAX_RAMP) {
    return { kind: "error", message: `Keep it to ${MAX_RAMP} glyphs.` };
  }
  if (new Set(glyphs).size < 2) {
    return { kind: "error", message: "Use at least two different glyphs." };
  }
  return { glyphs: glyphs.length, kind: "ok" };
};

// URL form ------------------------------------------------------------------

const round = (value: number, step: number) => Math.round(value / step) * step;

const numberIn = (min: number, max: number) =>
  z.coerce.number().pipe(z.number().min(min).max(max));

const HEX = /^#[\da-f]{6}$/iu;

const inkSchema = z.union([
  z.literal("theme"),
  z.enum(PHOSPHOR_NAMES),
  z
    .string()
    .regex(HEX)
    .transform((value): `#${string}` => `#${value.slice(1).toLowerCase()}`),
]);

const fxSchema = z.string().transform((value): Partial<FxSettings> => {
  const fx: Partial<Record<FxKey, number>> = {};
  for (const part of value.split(",")) {
    const [key, amount] = part.split(":");
    const parsed = Number(amount);
    const match = FX_KEYS.find((name) => name === key);
    if (match && Number.isFinite(parsed)) {
      fx[match] = Math.min(1, Math.max(0, parsed));
    }
  }
  return fx;
});

/** One parser per URL key. A bad value is dropped, never fatal. */
const LOOK_PARAMS = {
  ansi: z.enum(["vga", "xterm"]),
  background: z.enum(["paper", "transparent"]),
  brightness: numberIn(-1, 1),
  cell: numberIn(CELL_RANGE.min, CELL_RANGE.max).transform(Math.round),
  chars: z.string().refine((value) => checkRamp(value).kind === "ok"),
  charset: z.enum([...CHARSET_NAMES, "custom"]),
  colorMode: z.enum(STUDIO_COLOR_MODES),
  contrast: numberIn(0, 4),
  dither: z.enum(DITHER_OPTIONS),
  edgeThreshold: numberIn(0, 1),
  gamma: numberIn(0.2, 4),
  ink: inkSchema,
  interaction: z.enum(INTERACTIONS),
  invert: z.enum(["1", "0"]).transform((value) => value === "1"),
  ramp: z.enum(RAMP_NAMES),
  saturation: numberIn(0, 2),
  speed: numberIn(0, 4),
} as const;

/** Short, readable URL keys. */
const URL_KEYS = {
  ansi: "ansi",
  background: "bg",
  brightness: "brightness",
  cell: "cell",
  chars: "chars",
  charset: "charset",
  colorMode: "color",
  contrast: "contrast",
  dither: "dither",
  edgeThreshold: "edge",
  fx: "fx",
  gamma: "gamma",
  ink: "ink",
  interaction: "interaction",
  invert: "invert",
  ramp: "ramp",
  saturation: "saturation",
  speed: "speed",
} as const satisfies Record<LookKey, string>;

export const LOOK_KEYS = Object.keys(URL_KEYS).filter((key): key is LookKey =>
  Object.hasOwn(BASE_LOOK, key)
);

const MEDIA_KEYS = Object.keys(BASE_MEDIA).filter(
  (key): key is keyof MediaSettings => Object.hasOwn(BASE_MEDIA, key)
);

const MEDIA_PARAMS = {
  font: z.enum(TEXT_FONTS),
  image: z.enum(IMAGE_PRESETS.map((preset) => preset.id)),
  levels: z.enum(["1", "0"]).transform((value) => value === "1"),
  seed: z.string().max(48),
  text: z.string().max(64),
  video: z
    .string()
    .max(2048)
    .refine((value) => /^https?:\/\//iu.test(value)),
  weight: numberIn(100, 900).transform((value) => round(value, 100)),
} as const;

const SOURCE_PARAM = z.enum(SOURCE_IDS);

/** What Next hands a page as `searchParams`, or a live `URLSearchParams`. */
export type ParamsInput =
  | URLSearchParams
  | Readonly<Record<string, string | readonly string[] | undefined>>;

const readParam = (params: ParamsInput, key: string): string | undefined => {
  if (params instanceof URLSearchParams) {
    return params.get(key) ?? undefined;
  }
  const value = params[key];
  return typeof value === "string" ? value : value?.[0];
};

type Writable<T> = { -readonly [K in keyof T]: T[K] };

/** Parse a shared setup. Unknown keys and bad values fall back to defaults. */
export const parseStudioParams = (params: ParamsInput): StudioState => {
  const source = SOURCE_PARAM.safeParse(readParam(params, "source"));
  const overrides: Writable<LookOverrides> = {};

  const assign = <Key extends Exclude<LookKey, "fx">>(
    key: Key,
    schema: z.ZodType<Look[Key]>
  ) => {
    const raw = readParam(params, URL_KEYS[key]);
    if (raw === undefined) {
      return;
    }
    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      overrides[key] = parsed.data;
    }
  };
  assign("ansi", LOOK_PARAMS.ansi);
  assign("background", LOOK_PARAMS.background);
  assign("brightness", LOOK_PARAMS.brightness);
  assign("cell", LOOK_PARAMS.cell);
  assign("charset", LOOK_PARAMS.charset);
  assign("chars", LOOK_PARAMS.chars);
  assign("colorMode", LOOK_PARAMS.colorMode);
  assign("contrast", LOOK_PARAMS.contrast);
  assign("dither", LOOK_PARAMS.dither);
  assign("edgeThreshold", LOOK_PARAMS.edgeThreshold);
  assign("gamma", LOOK_PARAMS.gamma);
  assign("ink", LOOK_PARAMS.ink);
  assign("interaction", LOOK_PARAMS.interaction);
  assign("invert", LOOK_PARAMS.invert);
  assign("ramp", LOOK_PARAMS.ramp);
  assign("saturation", LOOK_PARAMS.saturation);
  assign("speed", LOOK_PARAMS.speed);

  const fxRaw = readParam(params, URL_KEYS.fx);
  if (fxRaw !== undefined) {
    const parsed = fxSchema.safeParse(fxRaw);
    if (parsed.success) {
      overrides.fx = { ...NO_FX, ...parsed.data };
    }
  }

  const media: Writable<MediaSettings> = { ...BASE_MEDIA };
  const mediaParam = <Key extends keyof MediaSettings>(
    key: Key,
    schema: z.ZodType<MediaSettings[Key]>
  ) => {
    const parsed = schema.safeParse(readParam(params, key));
    if (parsed.success) {
      media[key] = parsed.data;
    }
  };
  mediaParam("font", MEDIA_PARAMS.font);
  mediaParam("image", MEDIA_PARAMS.image);
  mediaParam("levels", MEDIA_PARAMS.levels);
  mediaParam("seed", MEDIA_PARAMS.seed);
  mediaParam("text", MEDIA_PARAMS.text);
  mediaParam("video", MEDIA_PARAMS.video);
  mediaParam("weight", MEDIA_PARAMS.weight);

  return {
    media,
    overrides,
    source: source.success ? source.data : DEFAULT_SOURCE,
  };
};

const flag = (value: boolean) => (value ? "1" : "0");

const formatNumber = (value: number) => String(Math.round(value * 100) / 100);

const encodeValue = (key: LookKey, value: Look[LookKey]): string => {
  if (typeof value === "boolean") {
    return flag(value);
  }
  if (typeof value === "number") {
    return formatNumber(value);
  }
  if (typeof value === "string") {
    return value;
  }
  // fx: only the effects that are on.
  return FX_KEYS.filter((name) => value[name] > 0)
    .map((name) => `${name}:${formatNumber(value[name])}`)
    .join(",");
};

const sameValue = (a: Look[LookKey], b: Look[LookKey]) =>
  typeof a === "object" && typeof b === "object"
    ? FX_KEYS.every((name) => a[name] === b[name])
    : a === b;

/**
 * The URL query for a setup, without the `?`. Only values that differ from
 * the source's defaults are written, in a fixed order, so equal setups
 * share one URL.
 */
export const studioQuery = (state: StudioState, defaults: Look): string => {
  const params = new URLSearchParams();
  params.set("source", state.source);
  for (const key of Object.keys(URL_KEYS).toSorted()) {
    const lookKey = LOOK_KEYS.find((name) => name === key);
    if (!lookKey) {
      continue;
    }
    const value = state.overrides[lookKey];
    if (value === undefined || sameValue(value, defaults[lookKey])) {
      continue;
    }
    const encoded = encodeValue(lookKey, value);
    if (encoded !== "") {
      params.set(URL_KEYS[lookKey], encoded);
    }
  }
  for (const key of MEDIA_KEYS) {
    const value = state.media[key];
    if (value !== BASE_MEDIA[key]) {
      params.set(key, typeof value === "boolean" ? flag(value) : String(value));
    }
  }
  return params.toString();
};
