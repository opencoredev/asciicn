import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the ripples main demo, shared by the page and the demo.

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
  label: "Crest colour",
  options: ASCII_COLOR_NAMES,
});

export const second = color({
  default: "blue",
  id: "second",
  label: "Second colour",
  options: ASCII_COLOR_NAMES,
});

export const rings = slider({
  default: 10,
  id: "rings",
  label: "Rings",
  max: 24,
  min: 3,
  step: 1,
});

export const decay = slider({
  default: 1,
  id: "decay",
  label: "Decay",
  max: 3,
  min: 0,
  step: 0.1,
});

export const interaction = segmented({
  default: "ripple",
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
  second,
  rings,
  decay,
  interaction,
  cell,
  animate,
];
