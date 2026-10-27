import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the murmuration main demo, shared by the page and the demo.

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

export const birds = slider({
  default: 3000,
  id: "birds",
  label: "Birds",
  max: 6000,
  min: 200,
  step: 100,
});

export const cohesion = slider({
  default: 1,
  id: "cohesion",
  label: "Cohesion",
  max: 3,
  min: 0,
  step: 0.1,
});

export const fold = slider({
  default: 1,
  id: "fold",
  label: "Fold",
  max: 3,
  min: 0,
  step: 0.1,
});

export const horizon = segmented({
  default: "reeds",
  id: "horizon",
  label: "Horizon",
  options: ["reeds", "trees", "none"] as const,
});

export const hawk = toggle({ default: true, id: "hawk", label: "Idle hawk" });

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
  birds,
  cohesion,
  fold,
  horizon,
  hawk,
  crt,
  speed,
  cell,
  interactive,
];
