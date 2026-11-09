import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the New York main demo, shared by the page and the demo.

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

export const intensity = slider({
  default: 1,
  id: "intensity",
  label: "Intensity",
  max: 1,
  min: 0,
  step: 0.05,
});

export const windows = slider({
  default: 0.55,
  id: "windows",
  label: "Windows",
  max: 1,
  min: 0,
  step: 0.05,
});

export const ferry = toggle({
  default: true,
  id: "ferry",
  label: "Ferry",
});

export const cell = slider({
  default: 7,
  id: "cell",
  label: "Cell",
  max: 14,
  min: 5,
  step: 1,
  unit: "px",
});

export const square = toggle({
  default: true,
  id: "square",
  label: "Square cells",
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
  intensity,
  windows,
  ferry,
  cell,
  square,
  animate,
];
