import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the campfire woods main demo, shared by the page and the demo.

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
  default: "ember",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const flame = slider({
  default: 1,
  id: "flame",
  label: "Flame",
  max: 1.6,
  min: 0.4,
  step: 0.1,
});

export const sparks = slider({
  default: 1,
  id: "sparks",
  label: "Sparks",
  max: 2,
  min: 0,
  step: 0.1,
});

export const smoke = slider({
  default: 1,
  id: "smoke",
  label: "Smoke",
  max: 1.5,
  min: 0,
  step: 0.1,
});

export const fireflies = slider({
  default: 9,
  id: "fireflies",
  label: "Fireflies",
  max: 12,
  min: 0,
  step: 1,
});

export const stars = slider({
  default: 1,
  id: "stars",
  label: "Stars",
  max: 2,
  min: 0,
  step: 0.1,
});

export const breeze = slider({
  default: 1,
  id: "breeze",
  label: "Breeze",
  max: 2,
  min: 0,
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
  flame,
  sparks,
  smoke,
  fireflies,
  stars,
  breeze,
  speed,
  cell,
  crt,
  interactive,
];
