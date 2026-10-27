import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the abyssal jellyfish main demo, shared by the page and the demo.

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
  default: "blueprint",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: PHOSPHOR_NAMES,
});

export const ramp = select({
  default: "glacier",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const jellies = slider({
  default: 5,
  id: "jellies",
  label: "Jellies",
  max: 7,
  min: 1,
  step: 1,
});

export const size = slider({
  default: 1,
  id: "size",
  label: "Size",
  max: 1.6,
  min: 0.5,
  step: 0.1,
});

export const tentacles = slider({
  default: 1,
  id: "tentacles",
  label: "Tentacles",
  max: 1.5,
  min: 0,
  step: 0.1,
});

export const hue = slider({
  default: 0,
  id: "hue",
  label: "Hue",
  max: 4,
  min: 0,
  step: 1,
});

export const rays = slider({
  default: 1,
  id: "rays",
  label: "Light rays",
  max: 1.5,
  min: 0,
  step: 0.1,
});

export const bubbles = slider({
  default: 1,
  id: "bubbles",
  label: "Bubbles",
  max: 1.5,
  min: 0,
  step: 0.1,
});

export const snow = slider({
  default: 1,
  id: "snow",
  label: "Marine snow",
  max: 2,
  min: 0,
  step: 0.1,
});

export const push = slider({
  default: 1,
  id: "push",
  label: "Push",
  max: 1,
  min: -1,
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
  jellies,
  size,
  tentacles,
  hue,
  rays,
  bubbles,
  snow,
  push,
  speed,
  cell,
  crt,
  interactive,
];
