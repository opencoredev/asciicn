import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the clockwork orrery main demo, shared by the page and the demo.

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
  default: "p3",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: PHOSPHOR_NAMES,
});

export const ramp = select({
  default: "heliograph",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const tilt = slider({
  default: 0.5,
  id: "tilt",
  label: "Tilt",
  max: 1,
  min: 0,
  step: 0.05,
});

export const glow = slider({
  default: 1,
  id: "glow",
  label: "Sun glow",
  max: 1.5,
  min: 0,
  step: 0.05,
});

export const engraving = slider({
  default: 1,
  id: "engraving",
  label: "Engraving",
  max: 1,
  min: 0,
  step: 0.05,
});

export const speed = slider({
  default: 1,
  id: "speed",
  label: "Speed",
  max: 3,
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
  tilt,
  glow,
  engraving,
  speed,
  cell,
  crt,
  interactive,
];
