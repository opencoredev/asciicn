/**
 * From a Studio look to what each renderer takes: props for a component
 * source, `mapTones` options for a media source, and the JSX attributes
 * for the export snippet. Pure.
 */

import type {
  StudioRenderProps,
  StudioSource,
} from "@/components/studio/sources";
import {
  BASE_LOOK,
  FX_KEYS,
  STUDIO_COLOR_MODES,
} from "@/components/studio/state";
import type {
  Look,
  LookOverrides,
  MonoInk,
  StudioColorMode,
} from "@/components/studio/state";
import type { MapOptions } from "@/lib/ascii/frame";
import { PHOSPHORS } from "@/lib/ascii/palettes";
import type { Grade, PhosphorName } from "@/lib/ascii/palettes";

export const sourceDefaults = (source: StudioSource): Look => ({
  ...BASE_LOOK,
  ...source.defaults,
});

/**
 * The colour modes a source can draw. Media has no palette of its own,
 * and `AsciiText` exports only mono and duotone.
 */
export const colorModesFor = (
  source: StudioSource
): readonly StudioColorMode[] => {
  if (source.id === "text") {
    return ["mono", "duotone"];
  }
  return source.kind === "media"
    ? STUDIO_COLOR_MODES.filter((mode) => mode !== "native")
    : STUDIO_COLOR_MODES;
};

/** The look on stage: defaults, then overrides the source can use. */
export const resolveLook = (
  source: StudioSource,
  overrides: LookOverrides
): Look => {
  const look = { ...sourceDefaults(source), ...overrides };
  return colorModesFor(source).includes(look.colorMode)
    ? look
    : { ...look, colorMode: sourceDefaults(source).colorMode };
};

const isPhosphor = (ink: MonoInk): ink is PhosphorName =>
  Object.hasOwn(PHOSPHORS, ink);

/** Ink and paper for mono, as CSS colours, or `null` for the site palette. */
export const monoColors = (
  ink: MonoInk
): { ink: string; paper: string } | null => {
  if (ink === "theme") {
    return null;
  }
  if (isPhosphor(ink)) {
    return PHOSPHORS[ink];
  }
  return { ink, paper: "--ascii-paper" };
};

export const lookGrade = (look: Look): Grade => ({
  brightness: look.brightness,
  contrast: look.contrast,
  gamma: look.gamma,
  saturation: look.saturation,
});

/** The engine's colour mode for a look. `native` is the source's palette. */
const engineColorMode = (look: Look) =>
  look.colorMode === "native" ? "palette" : look.colorMode;

/** Props for a component source. */
export const renderProps = (look: Look): StudioRenderProps => {
  const mono = look.colorMode === "mono" ? look.ink : "theme";
  return {
    ansi: look.ansi,
    background: look.background,
    cell: look.cell,
    chars: look.charset === "custom" ? look.chars : undefined,
    charset: look.charset === "custom" ? "standard" : look.charset,
    colorMode: engineColorMode(look),
    dither: look.dither,
    edgeThreshold: look.edgeThreshold,
    // Ink and paper spelled out as well as the phosphor: some components
    // default `ink` to the site token, which would win over the phosphor.
    ink: monoColors(mono)?.ink,
    interaction: look.interaction,
    invert: look.invert,
    paper: isPhosphor(mono) ? PHOSPHORS[mono].paper : undefined,
    phosphor: isPhosphor(mono) ? mono : undefined,
    ramp: look.ramp,
    speed: look.speed,
  };
};

/** `mapTones` options for a media source. `native` has no meaning there. */
export const mapOptions = (look: Look): MapOptions => ({
  ansi: look.ansi,
  chars: look.charset === "custom" ? look.chars : undefined,
  charset: look.charset === "custom" ? "standard" : look.charset,
  colorMode: look.colorMode === "native" ? "mono" : look.colorMode,
  dither: look.dither,
  edgeThreshold: look.edgeThreshold,
  grade: lookGrade(look),
  invert: look.invert,
  ramp: look.ramp,
});

const quote = (value: string) => JSON.stringify(value);

// A JSX string attribute has no escapes: a quote ends it and `&` starts an
// entity. Backslashes and control characters are spelled out for clarity.
const NEEDS_EXPRESSION = /["&\\\p{Cc}\u2028\u2029]/u;

/**
 * `name="value"` when the value can sit in a JSX string as is, otherwise
 * `name={"value"}` with the value as an escaped JS string, so ramps, seeds,
 * URLs and colours the user typed always export as valid TSX.
 */
export const stringAttribute = (name: string, value: string): string =>
  NEEDS_EXPRESSION.test(value)
    ? `${name}={${quote(value)}}`
    : `${name}="${value}"`;

const number = (value: number) => String(Math.round(value * 100) / 100);

/**
 * JSX attributes for the charset, the colour mode and everything else the
 * user changed from the source's defaults, in a stable order.
 */
const inkAttribute = (ink: MonoInk, media: boolean) => {
  if (isPhosphor(ink)) {
    return stringAttribute("phosphor", ink);
  }
  return media
    ? `style={{ "--ascii-ink": ${quote(ink)} } as React.CSSProperties}`
    : stringAttribute("ink", ink);
};

export const snippetAttributes = (
  look: Look,
  defaults: Look,
  {
    media = false,
  }: {
    /**
     * `AsciiImage` and `AsciiVideo` take the look props but no `ink`,
     * `interaction` or `speed`: a custom ink goes on `--ascii-ink` instead.
     */
    media?: boolean;
  } = {}
): string[] => {
  const attributes: string[] = [];
  const changed = <Key extends keyof Look>(key: Key) =>
    look[key] !== defaults[key];

  if (look.charset === "custom") {
    attributes.push(stringAttribute("chars", look.chars));
  } else {
    attributes.push(stringAttribute("charset", look.charset));
  }
  // Always spelled out: component defaults differ, and these two decide
  // most of the look.
  attributes.push(stringAttribute("colorMode", engineColorMode(look)));
  if (look.colorMode === "mono" && look.ink !== "theme") {
    attributes.push(inkAttribute(look.ink, media));
  }
  if (look.colorMode === "duotone") {
    attributes.push(stringAttribute("ramp", look.ramp));
  }
  if (look.colorMode === "ansi16" && look.ansi !== "vga") {
    attributes.push(stringAttribute("ansi", look.ansi));
  }
  if (changed("cell")) {
    attributes.push(`cell={${look.cell}}`);
  }
  const grade = (["brightness", "contrast", "gamma", "saturation"] as const)
    .filter((key) => changed(key))
    .map((key) => `${key}: ${number(look[key])}`);
  if (grade.length > 0) {
    attributes.push(`grade={{ ${grade.join(", ")} }}`);
  }
  if (changed("dither")) {
    attributes.push(stringAttribute("dither", look.dither));
  }
  if (look.invert) {
    attributes.push("invert");
  }
  if (look.charset === "edge" && changed("edgeThreshold")) {
    attributes.push(`edgeThreshold={${number(look.edgeThreshold)}}`);
  }
  if (look.background === "transparent") {
    attributes.push(`background="transparent"`);
  }
  const fx = FX_KEYS.filter((key) => look.fx[key] > 0).map(
    (key) => `${key}: ${number(look.fx[key])}`
  );
  if (fx.length > 0) {
    attributes.push(`fx={{ ${fx.join(", ")} }}`);
  }
  if (media) {
    return attributes;
  }
  if (changed("interaction")) {
    attributes.push(stringAttribute("interaction", look.interaction));
  }
  if (changed("speed")) {
    attributes.push(`speed={${number(look.speed)}}`);
  }
  return attributes;
};
