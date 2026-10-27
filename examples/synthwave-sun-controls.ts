import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the synthwave sun's main demo, shared by the page and the demo.

export const charset = select({
  default: "braille",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = select({
  default: "truecolor",
  id: "colorMode",
  label: "Colour mode",
  options: COLOR_MODES,
});

export const phosphor = select({
  default: "none",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: ["none", ...PHOSPHOR_NAMES],
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
  unit: "×",
});

export const slices = slider({
  default: 1,
  id: "slices",
  label: "Slices",
  max: 1,
  min: 0,
  step: 0.05,
});

export const glow = slider({
  default: 1,
  id: "glow",
  label: "Glow",
  max: 1,
  min: 0,
  step: 0.05,
});

export const mountains = slider({
  default: 1,
  id: "mountains",
  label: "Mountains",
  max: 2,
  min: 0,
  step: 0.1,
});

export const stars = toggle({
  default: true,
  id: "stars",
  label: "Stars",
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

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  phosphor,
  ramp,
  travel,
  slices,
  glow,
  mountains,
  stars,
  cell,
];
