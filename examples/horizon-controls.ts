import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the horizon main demo, shared by the page and the demo.

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
  label: "Rim",
  options: ASCII_COLOR_NAMES,
});

export const haze = color({
  default: "blue",
  id: "haze",
  label: "Haze",
  options: ASCII_COLOR_NAMES,
});

export const horizon = slider({
  default: 0.28,
  id: "horizon",
  label: "Horizon",
  max: 0.6,
  min: 0.1,
  step: 0.02,
});

export const curve = slider({
  default: 0.6,
  id: "curve",
  label: "Curve",
  max: 1,
  min: 0,
  step: 0.05,
});

export const glow = slider({
  default: 1,
  id: "glow",
  label: "Glow",
  max: 1,
  min: 0,
  step: 0.05,
});

export const aurora = slider({
  default: 1,
  id: "aurora",
  label: "Aurora",
  max: 1,
  min: 0,
  step: 0.05,
});

export const stars = slider({
  default: 1,
  id: "stars",
  label: "Stars",
  max: 3,
  min: 0,
  step: 0.25,
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
  haze,
  horizon,
  curve,
  glow,
  aurora,
  stars,
  interaction,
  cell,
  animate,
];
