import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the silk main demo, shared by the page and the demo.

export const charset = select({
  default: "blocks",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = select({
  default: "palette",
  id: "colorMode",
  label: "Colour mode",
  options: COLOR_MODES,
});

export const ink = color({
  default: "ink",
  id: "ink",
  label: "Light colour",
  options: ASCII_COLOR_NAMES,
});

export const shade = color({
  default: "purple",
  id: "shade",
  label: "Shade colour",
  options: ASCII_COLOR_NAMES,
});

export const folds = slider({
  default: 6,
  id: "folds",
  label: "Folds",
  max: 10,
  min: 1,
  step: 0.5,
});

export const angle = slider({
  default: 110,
  id: "angle",
  label: "Angle",
  max: 180,
  min: 0,
  step: 5,
  unit: "°",
});

export const sheen = slider({
  default: 0.6,
  id: "sheen",
  label: "Sheen",
  max: 1,
  min: 0,
  step: 0.05,
});

export const interaction = segmented({
  default: "none",
  id: "interaction",
  label: "Pointer",
  options: ["none", "repel", "ripple", "trail"],
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 20,
  min: 8,
  step: 1,
  unit: "px",
});

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Animate",
});

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  ink,
  shade,
  folds,
  angle,
  sheen,
  interaction,
  cell,
  animate,
];
