import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the circuit board main demo, shared by the page and the demo.

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

export const board = segmented({
  default: "green",
  id: "board",
  label: "Board (truecolor)",
  options: ["green", "navy"] as const,
});

export const phosphor = segmented({
  default: "p1",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: PHOSPHOR_NAMES,
});

export const ramp = select({
  default: "mainframe",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const growth = slider({
  default: 1,
  id: "growth",
  label: "Growth",
  max: 3,
  min: 0,
  step: 0.1,
});

export const traffic = slider({
  default: 1,
  id: "traffic",
  label: "Traffic",
  max: 3,
  min: 0,
  step: 0.1,
});

export const density = slider({
  default: 1,
  id: "density",
  label: "Density",
  max: 3,
  min: 0.25,
  step: 0.25,
});

export const crt = toggle({ default: true, id: "crt", label: "CRT" });

export const speed = slider({
  default: 1,
  id: "speed",
  label: "Speed",
  max: 3,
  min: 0,
  step: 0.25,
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 22,
  min: 8,
  step: 1,
  unit: "px",
});

export const interactive = toggle({
  default: true,
  id: "interactive",
  label: "Interactive",
});

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  board,
  phosphor,
  ramp,
  growth,
  traffic,
  density,
  crt,
  speed,
  cell,
  interactive,
];
