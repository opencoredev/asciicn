import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the donut chart's main demo, shared by the page and the demo.

export const mode = segmented({
  default: "donut",
  id: "mode",
  label: "Mode",
  options: ["donut", "pie"],
});

export const glyphs = segmented({
  default: "braille",
  id: "glyphs",
  label: "Glyphs",
  options: ["braille", "quadrants"],
});

export const firstColor = color({
  default: "blue",
  id: "color",
  label: "First slice",
  options: ASCII_COLOR_NAMES,
});

export const gap = slider({
  default: 2,
  id: "gap",
  label: "Gap",
  max: 4,
  min: 0,
  step: 1,
  unit: " dots",
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

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Sweep in",
});

/** Display order of the tray. */
export const controls = [mode, glyphs, firstColor, gap, cell, animate];
