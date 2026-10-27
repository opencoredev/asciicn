/**
 * Colour helpers for reading a captured frame: the RGB of one cell, and
 * the resolved CSS colours renderers report (`rgb()`, `rgba()` or hex) as
 * bytes, which the ANSI exporter needs.
 */

import type { AsciiFrame } from "@/lib/ascii/frame";
import { hexToRgb } from "@/lib/ascii/palettes";
import type { Rgb8 } from "@/lib/ascii/palettes";

const RGB = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/u;

/** A resolved CSS colour as bytes. Handles `rgb()`, `rgba()` and hex. */
export const cssToRgb = (value: string): Rgb8 => {
  const match = RGB.exec(value);
  if (match) {
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  return hexToRgb(value);
};

/** The colour of one cell, or `null` when it takes the ink. */
export const cellRgb = (frame: AsciiFrame, index: number): Rgb8 | null => {
  const { colors } = frame;
  if (!colors || (colors[index * 4 + 3] ?? 0) === 0) {
    return null;
  }
  const at = index * 4;
  return [colors[at] ?? 0, colors[at + 1] ?? 0, colors[at + 2] ?? 0];
};
