import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the metaballs main demo, shared by the page and the demo.

export const charset = select({
  default: "blocks",
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

export const variant = segmented({
  default: "solid",
  id: "variant",
  label: "Variant",
  options: ["solid", "rings"],
});

export const count = slider({
  default: 5,
  id: "count",
  label: "Count",
  max: 8,
  min: 2,
  step: 1,
});

export const size = slider({
  default: 1,
  id: "size",
  label: "Size",
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
  variant,
  count,
  size,
  interaction,
  cell,
  animate,
];
