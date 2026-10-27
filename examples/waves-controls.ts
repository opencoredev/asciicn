import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the waves main demo, shared by the page and the demo.

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
  label: "Crest colour",
  options: ASCII_COLOR_NAMES,
});

export const far = color({
  default: "blue",
  id: "far",
  label: "Far colour",
  options: ASCII_COLOR_NAMES,
});

export const variant = segmented({
  default: "ocean",
  id: "variant",
  label: "Variant",
  options: ["ocean", "lines"],
});

export const layers = slider({
  default: 6,
  id: "layers",
  label: "Layers",
  max: 8,
  min: 2,
  step: 1,
});

export const amplitude = slider({
  default: 1,
  id: "amplitude",
  label: "Amplitude",
  max: 2,
  min: 0,
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
  variant,
  layers,
  amplitude,
  interaction,
  cell,
  animate,
];
