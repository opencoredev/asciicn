import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the Rio de Janeiro main demo, shared by the page and the demo.

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

export const cableCar = toggle({
  default: true,
  id: "cableCar",
  label: "Cable car",
});

export const cell = slider({
  default: 7,
  id: "cell",
  label: "Cell",
  max: 16,
  min: 6,
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
  cableCar,
  cell,
  square,
  animate,
];
