import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the neon rain main demo, shared by the page and the demo.

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
  default: "blueprint",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: PHOSPHOR_NAMES,
});

export const ramp = select({
  default: "vapor",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const rain = slider({
  default: 0.7,
  id: "rain",
  label: "Rain",
  max: 1,
  min: 0,
  step: 0.05,
});

export const wind = slider({
  default: 0.35,
  id: "wind",
  label: "Wind",
  max: 1,
  min: -1,
  step: 0.05,
});

export const fog = slider({
  default: 0.6,
  id: "fog",
  label: "Fog",
  max: 1,
  min: 0,
  step: 0.05,
});

export const signs = slider({
  default: 0.6,
  id: "signs",
  label: "Signs",
  max: 1,
  min: 0,
  step: 0.05,
});

export const glitch = slider({
  default: 0.4,
  id: "glitch",
  label: "Glitch",
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
  rain,
  wind,
  fog,
  signs,
  glitch,
  speed,
  cell,
  crt,
  interactive,
];
