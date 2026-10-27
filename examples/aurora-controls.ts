import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the aurora main demo, shared by the page and the demo.

export const charset = select({
  default: "braille",
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
  label: "Edge colour",
  options: ASCII_COLOR_NAMES,
});

export const tip = color({
  default: "purple",
  id: "tip",
  label: "Tip colour",
  options: ASCII_COLOR_NAMES,
});

export const curtains = slider({
  default: 3,
  id: "curtains",
  label: "Curtains",
  max: 6,
  min: 1,
  step: 1,
});

export const height = slider({
  default: 0.42,
  id: "height",
  label: "Height",
  max: 0.8,
  min: 0.1,
  step: 0.02,
});

export const sway = slider({
  default: 1,
  id: "sway",
  label: "Sway",
  max: 3,
  min: 0,
  step: 0.25,
});

export const rays = slider({
  default: 8,
  id: "rays",
  label: "Rays",
  max: 20,
  min: 2,
  step: 1,
});

export const length = slider({
  default: 0.45,
  id: "length",
  label: "Ray length",
  max: 1,
  min: 0,
  step: 0.05,
});

export const glow = slider({
  default: 1,
  id: "glow",
  label: "Edge glow",
  max: 2,
  min: 0,
  step: 0.1,
});

export const tilt = slider({
  default: 0,
  id: "tilt",
  label: "Tilt",
  max: 30,
  min: -30,
  step: 1,
  unit: "°",
});

export const direction = segmented({
  default: "up",
  id: "direction",
  label: "Rays point",
  options: ["up", "down"],
});

export const mask = segmented({
  default: "none",
  id: "mask",
  label: "Mask",
  options: ["none", "top", "bottom", "edges"],
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
  tip,
  curtains,
  height,
  sway,
  rays,
  length,
  glow,
  tilt,
  direction,
  mask,
  interaction,
  cell,
  animate,
];
