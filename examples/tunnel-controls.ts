import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the tunnel main demo, shared by the page and the demo.

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
  label: "Near colour",
  options: ASCII_COLOR_NAMES,
});

export const far = color({
  default: "purple",
  id: "far",
  label: "Far colour",
  options: ASCII_COLOR_NAMES,
});

export const shape = segmented({
  default: "circle",
  id: "shape",
  label: "Shape",
  options: ["circle", "square"],
});

export const rings = slider({
  default: 1,
  id: "rings",
  label: "Rings",
  max: 3,
  min: 0.5,
  step: 0.25,
});

export const spokes = slider({
  default: 12,
  id: "spokes",
  label: "Spokes",
  max: 32,
  min: 0,
  step: 1,
});

export const fog = slider({
  default: 1,
  id: "fog",
  label: "Fog",
  max: 3,
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
  far,
  shape,
  rings,
  spokes,
  fog,
  interaction,
  cell,
  animate,
];
