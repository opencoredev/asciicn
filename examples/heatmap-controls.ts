import type { HEATMAP_GLYPHS as HEATMAP_GLYPHS_SOURCE } from "@/components/asciicn/heatmap";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const HEATMAP_GLYPHS = [
  "shades",
  "blocks",
  "ascii",
] as const satisfies typeof HEATMAP_GLYPHS_SOURCE;

// Knobs for the heatmap's main demo, shared by the page and the demo.

export const glyphs = segmented({
  default: "shades",
  id: "glyphs",
  label: "Glyphs",
  options: HEATMAP_GLYPHS,
});

export const tint = color({
  default: "green",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const steps = slider({
  default: 4,
  id: "steps",
  label: "Steps",
  max: 6,
  min: 2,
  step: 1,
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 16,
  min: 8,
  step: 1,
  unit: "px",
});

export const weekStart = segmented({
  default: "Sun",
  id: "weekStart",
  label: "Week starts",
  options: ["Sun", "Mon"],
});

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Sweep in",
});

/** Display order of the tray. */
export const controls = [glyphs, tint, steps, cell, weekStart, animate];
