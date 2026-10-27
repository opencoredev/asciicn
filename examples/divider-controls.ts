import { ASCII_COLOR_NAMES, FILL_VARIANTS } from "@/lib/ascii";
import { color, segmented, slider } from "@/lib/preview-controls";

// Knobs for the divider's main demo, shared by the page and the demo.

export const fill = segmented({
  default: "gradient",
  id: "fill",
  label: "Fill",
  options: FILL_VARIANTS,
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const thickness = slider({
  default: 2,
  id: "thickness",
  label: "Thickness",
  max: 6,
  min: 1,
  step: 1,
  unit: " cells",
});

export const fade = slider({
  default: 0.6,
  id: "fade",
  label: "Fade",
  max: 1,
  min: 0,
  step: 0.1,
});

/** Display order of the tray. */
export const controls = [fill, tint, thickness, fade];
