import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the matrix main demo, shared by the page and the demo.

export const charset = select({
  default: "katakana",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = select({
  default: "truecolor",
  id: "colorMode",
  label: "Colour mode",
  options: COLOR_MODES,
});

export const rain = color({
  default: "green",
  id: "color",
  label: "Rain colour",
  options: ASCII_COLOR_NAMES,
});

export const density = slider({
  default: 0.7,
  id: "density",
  label: "Density",
  max: 1,
  min: 0.1,
  step: 0.05,
});

export const length = slider({
  default: 16,
  id: "length",
  label: "Length",
  max: 40,
  min: 4,
  step: 1,
});

export const mutation = slider({
  default: 4,
  id: "mutation",
  label: "Mutation",
  max: 12,
  min: 0,
  step: 0.5,
});

export const depth = slider({
  default: 0.5,
  id: "depth",
  label: "Depth",
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
  default: 14,
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
  rain,
  density,
  length,
  mutation,
  depth,
  interaction,
  cell,
  animate,
];
