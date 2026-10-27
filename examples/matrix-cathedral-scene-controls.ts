import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the rain vault main demo, shared by the page and the demo.

export const charset = select({
  default: "katakana",
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
  default: "mainframe",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const glide = slider({
  default: 0.35,
  id: "glide",
  label: "Glide",
  max: 1.5,
  min: 0,
  step: 0.05,
});

export const density = slider({
  default: 0.7,
  id: "density",
  label: "Streams",
  max: 1,
  min: 0,
  step: 0.05,
});

export const fog = slider({
  default: 1,
  id: "fog",
  label: "Fog",
  max: 2,
  min: 0,
  step: 0.1,
});

export const light = toggle({ default: true, id: "light", label: "Light" });

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
  default: 14,
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
  glide,
  density,
  fog,
  light,
  crt,
  speed,
  cell,
  interactive,
];
