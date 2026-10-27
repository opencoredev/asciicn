import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider } from "@/lib/preview-controls";

// Knobs for the skeleton's main demo, shared by the page and the demo.

export const motion = segmented({
  default: "sweep",
  id: "motion",
  label: "Motion",
  options: ["sweep", "pulse", "none"],
});

export const chars = segmented({
  default: "░▒▓",
  id: "chars",
  label: "Glyphs",
  options: ["░▒▓", "·•●", ".:#", "⠂⠕⠿"],
});

export const tint = color({
  default: "grey",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 18,
  min: 8,
  step: 2,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [motion, chars, tint, cell];
