import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the plasma main demo, shared by the page and the demo.

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

export const scale = slider({
  default: 1,
  id: "scale",
  label: "Scale",
  max: 2.5,
  min: 0.4,
  step: 0.1,
});

export const warp = slider({
  default: 0.3,
  id: "warp",
  label: "Warp",
  max: 1,
  min: 0,
  step: 0.05,
});

export const bands = slider({
  default: 2,
  id: "bands",
  label: "Bands",
  max: 4,
  min: 0.5,
  step: 0.25,
});

export const crest = slider({
  default: 0.5,
  id: "crest",
  label: "Crest",
  max: 1,
  min: 0,
  step: 0.05,
});

export const intensity = slider({
  default: 1,
  id: "intensity",
  label: "Intensity",
  max: 1,
  min: 0.3,
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
  scale,
  warp,
  bands,
  crest,
  intensity,
  interaction,
  cell,
  animate,
];
