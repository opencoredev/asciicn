import { ASCII_NUMBER_FONTS } from "@/components/asciicn/ascii-number";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the ASCII number demo, shared by the page and the demo.

export const font = segmented({
  default: "blocks",
  id: "font",
  label: "Font",
  options: ASCII_NUMBER_FONTS,
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 20,
  min: 6,
  step: 1,
  unit: "px",
});

export const ghost = toggle({
  default: true,
  id: "ghost",
  label: "Ghost",
});

/** Display order of the tray. */
export const controls = [font, tint, cell, ghost];
