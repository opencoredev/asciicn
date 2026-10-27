import { CHARSET_NAMES, COLOR_MODES, PHOSPHOR_NAMES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the Tokyo main demo, shared by the page and the demo.

export const charset = select({
  default: "quadrants",
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

export const phosphor = segmented({
  default: "none",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: ["none", ...PHOSPHOR_NAMES],
});

export const fuji = toggle({
  default: true,
  id: "fuji",
  label: "Mount Fuji",
});

export const train = toggle({
  default: true,
  id: "train",
  label: "Train",
});

export const intensity = slider({
  default: 1,
  id: "intensity",
  label: "Intensity",
  max: 1,
  min: 0.2,
  step: 0.05,
});

export const cell = slider({
  default: 9,
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
  phosphor,
  fuji,
  train,
  intensity,
  cell,
  animate,
];
