import type { WovenBannerColors } from "@/components/asciicn/scenes/woven-banner-scene";
import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the woven banner main demo, shared by the page and the demo.

/** Cloth, thread and hem for each dye knob option. */
export const DYES = {
  crimson: ["#a3203a", "#f6e6c4", "#e0a83e"],
  indigo: ["#24306e", "#e9edf7", "#8fb3ff"],
  moss: ["#2f5a3a", "#f1e9c8", "#c8a24a"],
  saffron: ["#d98a1c", "#3a1a0c", "#7a2a14"],
} as const satisfies Record<string, WovenBannerColors>;

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
  default: "p1",
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

export const text = select({
  default: "ASCIICN",
  id: "text",
  label: "Text",
  options: ["ASCIICN", "HELLO WORLD", "OPEN SOURCE", "woven from words"],
});

export const dye = segmented({
  default: "crimson",
  id: "dye",
  label: "Dye",
  options: ["crimson", "indigo", "moss", "saffron"],
});

export const wind = slider({
  default: 1,
  id: "wind",
  label: "Wind",
  max: 3,
  min: 0,
  step: 0.1,
});

export const gusts = slider({
  default: 1,
  id: "gusts",
  label: "Gusts",
  max: 3,
  min: 0,
  step: 0.1,
});

export const streaks = toggle({
  default: true,
  id: "streaks",
  label: "Streaks",
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
  text,
  dye,
  wind,
  gusts,
  streaks,
  crt,
  speed,
  cell,
  interactive,
];
