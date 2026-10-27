/**
 * What the glyph inspector says about one cell: the glyph, its code point
 * and how much ink it carries. Pure.
 */

import {
  BRAILLE_BASE,
  CHARSET_NAMES,
  CHARSETS,
  EDGE_GLYPHS,
  QUADRANT_GLYPHS,
} from "@/lib/ascii/charsets";
import type { Charset } from "@/lib/ascii/charsets";

/** Set bits in a dot mask (Braille and quadrant glyphs are bit fields). */
const popcount = (value: number) =>
  [...value.toString(2)].filter((bit) => bit === "1").length;

export type Density =
  | { readonly kind: "level"; readonly value: number }
  | { readonly kind: "edge" }
  | { readonly kind: "unknown" };

/**
 * How dense a glyph is, 0 to 1: lit dots over all dots for Braille and
 * quadrants, the ramp position otherwise. Edge strokes have a direction,
 * not a density.
 */
export const glyphDensity = (glyph: string, charset: Charset): Density => {
  if (glyph === " " || glyph === "") {
    return { kind: "level", value: 0 };
  }
  const code = glyph.codePointAt(0) ?? 0;
  if (code >= BRAILLE_BASE && code < BRAILLE_BASE + 256) {
    return { kind: "level", value: popcount(code - BRAILLE_BASE) / 8 };
  }
  const quadrant = QUADRANT_GLYPHS.indexOf(glyph);
  if (quadrant !== -1) {
    return { kind: "level", value: popcount(quadrant) / 4 };
  }
  if (charset.kind === "edge" && EDGE_GLYPHS.includes(glyph)) {
    return { kind: "edge" };
  }
  const ramps = [
    charset,
    ...CHARSET_NAMES.map((name) => CHARSETS[name]),
  ] as const;
  for (const ramp of ramps) {
    const index = ramp.glyphs.indexOf(glyph);
    if (index !== -1 && ramp.glyphs.length > 1) {
      return { kind: "level", value: index / (ramp.glyphs.length - 1) };
    }
  }
  return { kind: "unknown" };
};

/** `U+2847`, padded to four hex digits. */
export const codePoint = (glyph: string): string =>
  `U+${(glyph.codePointAt(0) ?? 32).toString(16).toUpperCase().padStart(4, "0")}`;
