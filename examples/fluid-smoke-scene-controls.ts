import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the smoke plume main demo, shared by the page and the demo.

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

export const buoyancy = slider({
  default: 1,
  id: "buoyancy",
  label: "Buoyancy",
  max: 3,
  min: 0,
  step: 0.1,
});

export const swirl = slider({
  default: 1,
  id: "swirl",
  label: "Swirl",
  max: 3,
  min: 0,
  step: 0.1,
});

export const fade = slider({
  default: 1,
  id: "fade",
  label: "Fade",
  max: 3,
  min: 0,
  step: 0.1,
});

export const emitter = slider({
  default: 0.5,
  id: "emitter",
  label: "Emitter",
  max: 0.95,
  min: 0.05,
  step: 0.05,
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
  buoyancy,
  swirl,
  fade,
  emitter,
  crt,
  speed,
  cell,
  interactive,
];
