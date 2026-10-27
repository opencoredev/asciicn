import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the black hole main demo, shared by the page and the demo.

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
  default: "p3",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: PHOSPHOR_NAMES,
});

export const ramp = select({
  default: "ember",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const tilt = slider({
  default: 7,
  id: "tilt",
  label: "Tilt",
  max: 30,
  min: 0,
  step: 1,
  unit: "°",
});

export const spin = slider({
  default: 1,
  id: "spin",
  label: "Spin",
  max: 3,
  min: 0,
  step: 0.1,
});

export const doppler = slider({
  default: 1,
  id: "doppler",
  label: "Doppler",
  max: 1,
  min: 0,
  step: 0.05,
});

export const stars = slider({
  default: 1,
  id: "stars",
  label: "Stars",
  max: 2,
  min: 0,
  step: 0.1,
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
  tilt,
  spin,
  doppler,
  stars,
  speed,
  cell,
  crt,
  interactive,
];
