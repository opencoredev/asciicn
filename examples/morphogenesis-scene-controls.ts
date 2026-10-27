import type { MorphogenesisPattern } from "@/components/asciicn/scenes/morphogenesis-scene";
import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the morphogenesis main demo, shared by the page and the demo.

const PATTERNS = [
  "drift",
  "coral",
  "labyrinth",
  "fingerprint",
  "spots",
] as const satisfies readonly MorphogenesisPattern[];

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
  default: "p1",
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

export const pattern = segmented({
  default: "drift",
  id: "pattern",
  label: "Pattern",
  options: PATTERNS,
});

export const growth = slider({
  default: 1,
  id: "growth",
  label: "Growth",
  max: 3,
  min: 0,
  step: 0.1,
});

export const drift = slider({
  default: 1,
  id: "drift",
  label: "Drift",
  max: 3,
  min: 0,
  step: 0.1,
});

export const scale = slider({
  default: 1,
  id: "scale",
  label: "Scale",
  max: 2,
  min: 0.5,
  step: 0.1,
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
  pattern,
  growth,
  drift,
  scale,
  crt,
  speed,
  cell,
  interactive,
];
