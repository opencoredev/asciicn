import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the contours main demo, shared by the page and the demo.

export const charset = select({
  default: "braille",
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
  label: "Ink",
  options: ASCII_COLOR_NAMES,
});

export const lines = slider({
  default: 12,
  id: "lines",
  label: "Lines",
  max: 32,
  min: 4,
  step: 1,
});

export const index = slider({
  default: 5,
  id: "index",
  label: "Index every",
  max: 8,
  min: 0,
  step: 1,
});

export const relief = slider({
  default: 0.4,
  id: "relief",
  label: "Relief",
  max: 1,
  min: 0,
  step: 0.05,
});

export const weight = slider({
  default: 1.2,
  id: "weight",
  label: "Weight",
  max: 3,
  min: 0.6,
  step: 0.1,
});

export const scale = slider({
  default: 1,
  id: "scale",
  label: "Scale",
  max: 2,
  min: 0.5,
  step: 0.1,
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
  lines,
  index,
  relief,
  weight,
  scale,
  interaction,
  cell,
  animate,
];
