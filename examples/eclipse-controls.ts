import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the eclipse main demo, shared by the page and the demo.

export const charset = select({
  default: "standard",
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

export const ink = color({
  default: "ink",
  id: "ink",
  label: "Corona",
  options: ASCII_COLOR_NAMES,
});

export const size = slider({
  default: 0.24,
  id: "size",
  label: "Size",
  max: 0.4,
  min: 0.1,
  step: 0.01,
});

export const corona = slider({
  default: 0.55,
  id: "corona",
  label: "Corona reach",
  max: 1,
  min: 0,
  step: 0.05,
});

export const streamers = slider({
  default: 0.6,
  id: "streamers",
  label: "Streamers",
  max: 1,
  min: 0,
  step: 0.05,
});

export const light = slider({
  default: 315,
  id: "light",
  label: "Light",
  max: 360,
  min: 0,
  step: 5,
  unit: "\u00B0",
});

export const pulse = slider({
  default: 0.5,
  id: "pulse",
  label: "Pulse",
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
  size,
  corona,
  streamers,
  light,
  pulse,
  interaction,
  cell,
  animate,
];
