import { CHARSET_NAMES, COLOR_MODES, RAMP_NAMES } from "@/lib/ascii";
import { select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the torus knot's main demo, shared by the page and the demo.

export const charset = select({
  default: "blocks",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = select({
  default: "truecolor",
  id: "colorMode",
  label: "Colour",
  options: COLOR_MODES,
});

export const ramp = select({
  default: "vapor",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const p = slider({
  default: 2,
  id: "p",
  label: "p (around)",
  max: 7,
  min: 1,
  step: 1,
});

export const q = slider({
  default: 5,
  id: "q",
  label: "q (through)",
  max: 9,
  min: 1,
  step: 1,
});

export const thickness = slider({
  default: 0.13,
  id: "thickness",
  label: "Thickness",
  max: 0.3,
  min: 0.04,
  step: 0.01,
});

export const speed = slider({
  default: 1,
  id: "speed",
  label: "Speed",
  max: 3,
  min: 0,
  step: 0.1,
  unit: "×",
});

export const cell = slider({
  default: 10,
  id: "cell",
  label: "Cell",
  max: 18,
  min: 6,
  step: 1,
  unit: "px",
});

export const contours = toggle({
  default: true,
  id: "contours",
  label: "Contours",
});

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  ramp,
  p,
  q,
  thickness,
  speed,
  cell,
  contours,
];
