import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the dot map's main demo, shared by the page and the demo.

export const glyphs = segmented({
  default: "braille",
  id: "glyphs",
  label: "Glyphs",
  options: ["braille", "halftone"],
});

export const accent = color({
  default: "ink",
  id: "accent",
  label: "Accent",
  options: ASCII_COLOR_NAMES,
});

export const land = color({
  default: "grey",
  id: "color",
  label: "Land",
  options: ASCII_COLOR_NAMES,
});

export const cell = slider({
  default: 10,
  id: "cell",
  label: "Cell",
  max: 16,
  min: 6,
  step: 1,
  unit: "px",
});

export const halo = slider({
  default: 8,
  id: "halo",
  label: "Halo",
  max: 20,
  min: 0,
  step: 2,
  unit: "°",
});

export const arcs = toggle({ default: true, id: "arcs", label: "Arcs" });

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Animate",
});

/** Display order of the tray. */
export const controls = [glyphs, accent, land, cell, halo, arcs, animate];
