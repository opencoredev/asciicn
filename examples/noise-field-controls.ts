import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the noise field main demo, shared by the page and the demo.

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
  label: "Ink",
  options: ASCII_COLOR_NAMES,
});

export const variant = segmented({
  default: "smoke",
  id: "variant",
  label: "Variant",
  options: ["smoke", "ridges", "contours", "marble"],
});

export const scale = slider({
  default: 0.8,
  id: "scale",
  label: "Scale",
  max: 4,
  min: 0.4,
  step: 0.1,
});

export const warp = slider({
  default: 1.7,
  id: "warp",
  label: "Warp",
  max: 4,
  min: 0,
  step: 0.1,
});

export const detail = slider({
  default: 3,
  id: "detail",
  label: "Detail",
  max: 6,
  min: 1,
  step: 1,
});

export const contrast = slider({
  default: 1.5,
  id: "contrast",
  label: "Contrast",
  max: 3,
  min: 0.5,
  step: 0.1,
});

export const mask = segmented({
  default: "none",
  id: "mask",
  label: "Mask",
  options: ["none", "center", "top", "bottom", "edges"],
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
  scale,
  warp,
  detail,
  contrast,
  mask,
  interaction,
  cell,
  animate,
];
