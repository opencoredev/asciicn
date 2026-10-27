import type {
  GLITCH_GLYPH_NAMES as GLITCH_GLYPH_NAMES_SOURCE,
  GLITCH_TRIGGERS as GLITCH_TRIGGERS_SOURCE,
} from "@/components/asciicn/glitch-text";
import { segmented, select, slider } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const GLITCH_GLYPH_NAMES = [
  "mixed",
  "blocks",
  "box",
  "shades",
] as const satisfies typeof GLITCH_GLYPH_NAMES_SOURCE;
const GLITCH_TRIGGERS = [
  "auto",
  "hover",
  "inView",
] as const satisfies typeof GLITCH_TRIGGERS_SOURCE;

// Knobs for the glitch text demo, shared by the page and the demo.

export const glyphs = select({
  default: "mixed",
  id: "glyphs",
  label: "Glyphs",
  options: GLITCH_GLYPH_NAMES,
});

export const trigger = segmented({
  default: "auto",
  id: "trigger",
  label: "Trigger",
  options: GLITCH_TRIGGERS,
});

export const intensity = slider({
  default: 35,
  id: "intensity",
  label: "Intensity",
  max: 100,
  min: 0,
  step: 5,
  unit: "%",
});

export const interval = slider({
  default: 2,
  id: "interval",
  label: "Interval",
  max: 6,
  min: 0.5,
  step: 0.5,
  unit: "s",
});

/** Display order of the tray. */
export const controls = [glyphs, trigger, intensity, interval];
