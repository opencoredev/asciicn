import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the mesh gradient main demo, shared by the page and the demo.

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

export const blobs = slider({
  default: 4,
  id: "blobs",
  label: "Blobs",
  max: 5,
  min: 3,
  step: 1,
});

export const size = slider({
  default: 0.6,
  id: "size",
  label: "Size",
  max: 1,
  min: 0.3,
  step: 0.05,
});

export const warp = slider({
  default: 0.35,
  id: "warp",
  label: "Warp",
  max: 1,
  min: 0,
  step: 0.05,
});

export const contrast = slider({
  default: 0.7,
  id: "contrast",
  label: "Contrast",
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
  blobs,
  size,
  warp,
  contrast,
  interaction,
  cell,
  animate,
];
