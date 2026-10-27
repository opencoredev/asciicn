import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the outrun horizon main demo, shared by the page and the demo.

export const charset = select({
  default: "braille",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = segmented({
  default: "truecolor",
  id: "colorMode",
  label: "Colour",
  options: COLOR_MODES,
});

export const phosphor = segmented({
  default: "p1",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: PHOSPHOR_NAMES,
});

export const ramp = select({
  default: "outrun",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const travel = slider({
  default: 1,
  id: "travel",
  label: "Travel",
  max: 3,
  min: 0,
  step: 0.1,
});

export const mountains = slider({
  default: 1,
  id: "mountains",
  label: "Mountains",
  max: 2,
  min: 0,
  step: 0.1,
});

export const sunBands = slider({
  default: 1,
  id: "sunBands",
  label: "Sun bands",
  max: 1,
  min: 0,
  step: 0.05,
});

export const shimmer = slider({
  default: 0.5,
  id: "shimmer",
  label: "Shimmer",
  max: 1,
  min: 0,
  step: 0.05,
});

export const speed = slider({
  default: 1,
  id: "speed",
  label: "Speed",
  max: 2.5,
  min: 0,
  step: 0.1,
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

export const crt = toggle({
  default: false,
  id: "crt",
  label: "CRT",
});

export const interactive = toggle({
  default: true,
  id: "interactive",
  label: "Pointer",
});

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  phosphor,
  ramp,
  travel,
  mountains,
  sunBands,
  shimmer,
  speed,
  cell,
  crt,
  interactive,
];
