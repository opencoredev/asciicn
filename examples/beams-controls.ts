import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the beams main demo, shared by the page and the demo.

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
  label: "Light",
  options: ASCII_COLOR_NAMES,
});

export const far = color({
  default: "ink",
  id: "far",
  label: "Far colour",
  options: ASCII_COLOR_NAMES,
});

export const rays = slider({
  default: 9,
  id: "rays",
  label: "Rays",
  max: 20,
  min: 2,
  step: 1,
});

export const spread = slider({
  default: 80,
  id: "spread",
  label: "Spread",
  max: 160,
  min: 20,
  step: 5,
  unit: "\u00B0",
});

export const sweep = slider({
  default: 6,
  id: "sweep",
  label: "Sweep",
  max: 20,
  min: 0,
  step: 1,
  unit: "\u00B0",
});

export const reach = slider({
  default: 1,
  id: "reach",
  label: "Reach",
  max: 2,
  min: 0.3,
  step: 0.1,
});

export const dust = slider({
  default: 0.4,
  id: "dust",
  label: "Dust",
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
  far,
  rays,
  spread,
  sweep,
  reach,
  dust,
  interaction,
  cell,
  animate,
];
