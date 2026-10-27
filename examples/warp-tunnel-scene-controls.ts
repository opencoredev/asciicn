import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the warp tunnel main demo, shared by the page and the demo.

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
  default: "vapor",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const velocity = slider({
  default: 1,
  id: "velocity",
  label: "Velocity",
  max: 3,
  min: 0.2,
  step: 0.1,
});

export const streak = slider({
  default: 1,
  id: "streak",
  label: "Streak",
  max: 3,
  min: 0.2,
  step: 0.1,
});

export const density = slider({
  default: 1,
  id: "density",
  label: "Density",
  max: 2,
  min: 0.2,
  step: 0.1,
});

export const twist = slider({
  default: 0.35,
  id: "twist",
  label: "Twist",
  max: 1.5,
  min: -1.5,
  step: 0.05,
});

export const walls = slider({
  default: 1,
  id: "walls",
  label: "Walls",
  max: 1.5,
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
  velocity,
  streak,
  density,
  twist,
  walls,
  speed,
  cell,
  crt,
  interactive,
];
