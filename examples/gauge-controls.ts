import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the gauge's main demo, shared by the page and the demo.

export const value = slider({
  default: 68,
  id: "value",
  label: "Load",
  max: 100,
  min: 0,
  step: 1,
  unit: "%",
});

export const variant = segmented({
  default: "half",
  id: "variant",
  label: "Variant",
  options: ["half", "dial", "ring", "linear"],
});

export const indicator = segmented({
  default: "arc",
  id: "indicator",
  label: "Indicator",
  options: ["arc", "needle"],
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const thresholds = toggle({
  default: true,
  id: "thresholds",
  label: "Thresholds",
});

/** Display order of the tray. */
export const controls = [value, variant, indicator, tint, thresholds];
