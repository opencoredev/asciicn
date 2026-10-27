import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the tempest storm main demo, shared by the page and the demo.

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

export const strikes = slider({
  default: 1,
  id: "strikes",
  label: "Strikes",
  max: 3,
  min: 0,
  step: 0.1,
});

export const flash = slider({
  default: 1,
  id: "flash",
  label: "Flash",
  max: 1.5,
  min: 0,
  step: 0.1,
});

export const rain = slider({
  default: 1,
  id: "rain",
  label: "Rain",
  max: 2,
  min: 0,
  step: 0.1,
});

export const wind = slider({
  default: 1,
  id: "wind",
  label: "Wind",
  max: 2,
  min: -2,
  step: 0.1,
});

export const speed = slider({
  default: 1,
  id: "speed",
  label: "Speed",
  max: 2.5,
  min: 0.1,
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
  strikes,
  flash,
  rain,
  wind,
  speed,
  cell,
  crt,
  interactive,
];
