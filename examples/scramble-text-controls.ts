import type {
  SCRAMBLE_GLYPH_NAMES as SCRAMBLE_GLYPH_NAMES_SOURCE,
  SCRAMBLE_TRIGGERS as SCRAMBLE_TRIGGERS_SOURCE,
} from "@/components/asciicn/scramble-text";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, select, slider } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const SCRAMBLE_GLYPH_NAMES = [
  "katakana",
  "braille",
  "cp437",
  "petscii",
  "blocks",
  "symbols",
  "hex",
  "binary",
] as const satisfies typeof SCRAMBLE_GLYPH_NAMES_SOURCE;
const SCRAMBLE_TRIGGERS = [
  "mount",
  "view",
  "hover",
  "loop",
] as const satisfies typeof SCRAMBLE_TRIGGERS_SOURCE;

// Knobs for the scramble text demo, shared by the page and the demo.

export const glyphs = select({
  default: "katakana",
  id: "glyphs",
  label: "Glyphs",
  options: SCRAMBLE_GLYPH_NAMES,
});

export const trigger = segmented({
  default: "loop",
  id: "trigger",
  label: "Trigger",
  options: SCRAMBLE_TRIGGERS,
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const stagger = slider({
  default: 35,
  id: "stagger",
  label: "Stagger",
  max: 120,
  min: 10,
  step: 5,
  unit: "ms",
});

/** Display order of the tray. */
export const controls = [glyphs, trigger, tint, stagger];
