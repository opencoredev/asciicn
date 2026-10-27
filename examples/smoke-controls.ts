import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the smoke main demo, shared by the page and the demo.

export const charset = select({
  default: "standard",
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
  label: "Lit colour",
  options: ASCII_COLOR_NAMES,
});

export const shadow = color({
  default: "grey",
  id: "shadow",
  label: "Shadow colour",
  options: ASCII_COLOR_NAMES,
});

export const scale = slider({
  default: 1,
  id: "scale",
  label: "Scale",
  max: 2.5,
  min: 0.5,
  step: 0.1,
});

export const height = slider({
  default: 0.8,
  id: "height",
  label: "Height",
  max: 1,
  min: 0.2,
  step: 0.05,
});

export const wind = slider({
  default: 0.2,
  id: "wind",
  label: "Wind",
  max: 2,
  min: -2,
  step: 0.1,
});

export const density = slider({
  default: 1,
  id: "density",
  label: "Density",
  max: 1.5,
  min: 0.3,
  step: 0.05,
});

export const interaction = segmented({
  default: "trail",
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
  shadow,
  scale,
  height,
  wind,
  density,
  interaction,
  cell,
  animate,
];
