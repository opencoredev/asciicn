import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the sacred torus main demo, shared by the page and the demo.

export const charset = select({
  default: "standard",
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
  default: "ibm",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: PHOSPHOR_NAMES,
});

export const ramp = select({
  default: "orchid",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const knot = segmented({
  default: "cycle",
  id: "knot",
  label: "Knot",
  options: ["cycle", "2:3", "3:5", "5:2", "3:4", "2:7"],
});

export const tube = slider({
  default: 0.12,
  id: "tube",
  label: "Tube",
  max: 0.3,
  min: 0.04,
  step: 0.01,
});

export const solids = toggle({ default: true, id: "solids", label: "Solids" });

export const contours = toggle({
  default: true,
  id: "contours",
  label: "Contours",
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
  phosphor,
  ramp,
  knot,
  tube,
  solids,
  contours,
  crt,
  speed,
  cell,
  interactive,
];
