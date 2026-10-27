import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the empty state's main demo, shared by the page and the demo.

export const illustration = segmented({
  default: "inbox",
  id: "illustration",
  label: "Illustration",
  options: ["inbox", "search", "folder", "cable"],
});

export const tint = color({
  default: "blue",
  id: "color",
  label: "Accent",
  options: ASCII_COLOR_NAMES,
});

export const cell = slider({
  default: 14,
  id: "cell",
  label: "Cell",
  max: 20,
  min: 10,
  step: 2,
  unit: "px",
});

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Animate",
});

/** Display order of the tray. */
export const controls = [illustration, tint, cell, animate];
