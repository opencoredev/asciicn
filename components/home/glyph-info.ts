import {
  BRAILLE_BASE,
  EDGE_GLYPHS,
  QUADRANT_GLYPHS,
  resolveCharset,
} from "@/lib/ascii";
import type { AsciiFrame, CharsetName } from "@/lib/ascii";

/** What the glyph inspector shows for one cell. */
export interface GlyphInfo {
  readonly column: number;
  readonly row: number;
  readonly glyph: string;
  /** `U+28FF` style. */
  readonly codePoint: string;
  /** Ink coverage the glyph stands for, 0 to 1, or null if it isn't in the set. */
  readonly density: number | null;
  /** The cell's own colour as `#rrggbb`, or null when it takes the ink. */
  readonly color: string | null;
}

const bits = (value: number) => {
  let count = 0;
  let rest = value;
  while (rest > 0) {
    count += rest % 2;
    rest = Math.floor(rest / 2);
  }
  return count;
};

/** How much of a cell the glyph inks, by its place in the charset. */
export const glyphDensity = (
  glyph: string,
  charsetName: CharsetName
): number | null => {
  const code = glyph.codePointAt(0) ?? 0;
  if (glyph === " ") {
    return 0;
  }
  if (code >= BRAILLE_BASE && code < BRAILLE_BASE + 256) {
    return bits(code - BRAILLE_BASE) / 8;
  }
  const quadrant = QUADRANT_GLYPHS.indexOf(glyph);
  if (quadrant > 0) {
    return bits(quadrant) / 4;
  }
  const { glyphs, kind } = resolveCharset(charsetName);
  // Edge glyphs mark a gradient's direction, not a tone.
  if (kind === "edge" && EDGE_GLYPHS.includes(glyph)) {
    return null;
  }
  const index = glyphs.indexOf(glyph);
  return index === -1 ? null : index / Math.max(1, glyphs.length - 1);
};

const toHex = (value: number) => value.toString(16).padStart(2, "0");

export const readGlyph = (
  frame: AsciiFrame,
  column: number,
  row: number,
  charsetName: CharsetName
): GlyphInfo | null => {
  if (column < 0 || row < 0 || column >= frame.columns || row >= frame.rows) {
    return null;
  }
  const index = row * frame.columns + column;
  const glyph = frame.glyphs[index] ?? " ";
  const code = glyph.codePointAt(0) ?? 32;
  const { colors } = frame;
  const color =
    colors && colors[index * 4 + 3] > 0
      ? `#${toHex(colors[index * 4])}${toHex(colors[index * 4 + 1])}${toHex(colors[index * 4 + 2])}`
      : null;
  return {
    codePoint: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
    color,
    column,
    density: glyphDensity(glyph, charsetName),
    glyph,
    row,
  };
};
