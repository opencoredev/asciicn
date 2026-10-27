import {
  SCRAMBLE_GLYPH_NAMES,
  SCRAMBLE_TRIGGERS,
} from "@/components/asciicn/scramble-text";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, select, slider } from "@/lib/preview-controls";

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
