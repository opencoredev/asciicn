import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the retro grid main demo, shared by the page and the demo.

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
  label: "Grid",
  options: ASCII_COLOR_NAMES,
});

export const sunColor = color({
  default: "orange",
  id: "sunColor",
  label: "Sun",
  options: ASCII_COLOR_NAMES,
});

export const horizon = slider({
  default: 0.42,
  id: "horizon",
  label: "Horizon",
  max: 0.7,
  min: 0.2,
  step: 0.02,
});

export const sun = slider({
  default: 0.4,
  id: "sun",
  label: "Sun size",
  max: 0.8,
  min: 0,
  step: 0.05,
});

export const columns = slider({
  default: 10,
  id: "columns",
  label: "Columns",
  max: 20,
  min: 4,
  step: 1,
});

export const slits = slider({
  default: 4,
  id: "slits",
  label: "Slits",
  max: 8,
  min: 0,
  step: 1,
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
  sunColor,
  horizon,
  sun,
  columns,
  slits,
  interaction,
  cell,
  animate,
];
