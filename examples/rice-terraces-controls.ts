import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the rice terraces main demo, shared by the page and the demo.

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

export const bird = toggle({
  default: true,
  id: "bird",
  label: "Bird",
});

export const square = toggle({
  default: true,
  id: "square",
  label: "Square cells",
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
  bird,
  square,
  cell,
  animate,
];
