import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the hourglass main demo, shared by the page and the demo.

export const charset = select({
  default: "dense",
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
  default: "sodium",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const finish = segmented({
  default: "walnut",
  id: "finish",
  label: "Finish",
  options: ["walnut", "brass", "ebony"],
});

export const duration = slider({
  default: 20,
  id: "duration",
  label: "Pour",
  max: 60,
  min: 4,
  step: 1,
  unit: "s",
});

export const fill = slider({
  default: 0.6,
  id: "fill",
  label: "Fill",
  max: 0.85,
  min: 0.15,
  step: 0.05,
});

export const tilt = slider({
  default: 18,
  id: "tilt",
  label: "Tilt",
  max: 40,
  min: 0,
  step: 1,
  unit: "°",
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
  finish,
  duration,
  fill,
  tilt,
  crt,
  speed,
  cell,
  interactive,
];
