import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the ridgelines main demo, shared by the page and the demo.

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
  label: "Front",
  options: ASCII_COLOR_NAMES,
});

export const far = color({
  default: "ink",
  id: "far",
  label: "Back",
  options: ASCII_COLOR_NAMES,
});

export const lines = slider({
  default: 32,
  id: "lines",
  label: "Lines",
  max: 64,
  min: 8,
  step: 1,
});

export const amplitude = slider({
  default: 1,
  id: "amplitude",
  label: "Amplitude",
  max: 2.5,
  min: 0,
  step: 0.1,
});

export const spread = slider({
  default: 0.5,
  id: "spread",
  label: "Spread",
  max: 1,
  min: 0.2,
  step: 0.05,
});

export const shade = slider({
  default: 0.25,
  id: "shade",
  label: "Shade",
  max: 0.5,
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
  far,
  lines,
  amplitude,
  spread,
  shade,
  interaction,
  cell,
  animate,
];
