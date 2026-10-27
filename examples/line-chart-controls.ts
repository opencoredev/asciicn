import type { CHART_GLYPHS as CHART_GLYPHS_SOURCE } from "@/components/asciicn/cartesian-chart";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const CHART_GLYPHS = [
  "braille",
  "blocks",
  "ascii",
] as const satisfies typeof CHART_GLYPHS_SOURCE;

// Knobs for the line chart's main demo, shared by the page and the demo.

export const glyphs = segmented({
  default: "braille",
  id: "glyphs",
  label: "Glyphs",
  options: CHART_GLYPHS,
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const markers = segmented({
  default: "last",
  id: "markers",
  label: "Markers",
  options: ["all", "last", "none"],
});

export const curve = segmented({
  default: "smooth",
  id: "curve",
  label: "Curve",
  options: ["smooth", "linear"],
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 18,
  min: 8,
  step: 1,
  unit: "px",
});

export const glow = toggle({
  default: false,
  id: "glow",
  label: "Glow",
});

export const interactive = toggle({
  default: true,
  id: "interactive",
  label: "Interactive",
});

/** Display order of the tray. */
export const controls = [glyphs, tint, markers, curve, cell, glow, interactive];
