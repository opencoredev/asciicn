import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the starfield main demo, shared by the page and the demo.

export const charset = select({
  default: "dots",
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
  label: "Star colour",
  options: ASCII_COLOR_NAMES,
});

export const haze = color({
  default: "blue",
  id: "haze",
  label: "Haze colour",
  options: ASCII_COLOR_NAMES,
});

export const density = slider({
  default: 1,
  id: "density",
  label: "Density",
  max: 2,
  min: 0.2,
  step: 0.1,
});

export const twinkle = slider({
  default: 0.6,
  id: "twinkle",
  label: "Twinkle",
  max: 1,
  min: 0,
  step: 0.05,
});

export const drift = slider({
  default: 1.6,
  id: "drift",
  label: "Drift",
  max: 8,
  min: 0,
  step: 0.2,
});

export const hazeAmount = slider({
  default: 0.5,
  id: "hazeAmount",
  label: "Haze",
  max: 1,
  min: 0,
  step: 0.05,
});

export const temperature = slider({
  default: 0.6,
  id: "temperature",
  label: "Temperature",
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
  haze,
  density,
  twinkle,
  drift,
  hazeAmount,
  temperature,
  interaction,
  cell,
  animate,
];
