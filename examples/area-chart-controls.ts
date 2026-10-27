import type {
  CHART_FILLS as CHART_FILLS_SOURCE,
  CHART_GLYPHS as CHART_GLYPHS_SOURCE,
} from "@/components/asciicn/cartesian-chart";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const CHART_FILLS = [
  "gradient",
  "solid",
  "pattern",
] as const satisfies typeof CHART_FILLS_SOURCE;
const CHART_GLYPHS = [
  "braille",
  "blocks",
  "ascii",
] as const satisfies typeof CHART_GLYPHS_SOURCE;

// Knobs for the area chart's main demo, shared by the page and the demo.

export const glyphs = segmented({
  default: "blocks",
  id: "glyphs",
  label: "Glyphs",
  options: CHART_GLYPHS,
});

export const stack = segmented({
  default: "none",
  id: "stack",
  label: "Stack",
  options: ["none", "stacked", "percent"],
});

export const fill = segmented({
  default: "gradient",
  id: "fill",
  label: "Fill",
  options: CHART_FILLS,
});

export const firstColor = color({
  default: "ink",
  id: "color",
  label: "First series",
  options: ASCII_COLOR_NAMES,
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
export const controls = [
  glyphs,
  stack,
  fill,
  firstColor,
  cell,
  glow,
  interactive,
];
