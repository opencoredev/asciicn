import { CHARSET_NAMES, COLOR_MODES, PHOSPHOR_NAMES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the Hong Kong main demo, shared by the page and the demo.

export const charset = select({
  default: "dots",
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

export const phosphor = segmented({
  default: "none",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: ["none", ...PHOSPHOR_NAMES],
});

export const lights = slider({
  default: 1,
  id: "lights",
  label: "Colour lights",
  max: 1,
  min: 0,
  step: 0.05,
});

export const junk = toggle({
  default: true,
  id: "junk",
  label: "Junk",
});

export const mist = slider({
  default: 1,
  id: "mist",
  label: "Mist",
  max: 1,
  min: 0,
  step: 0.05,
});

export const intensity = slider({
  default: 1,
  id: "intensity",
  label: "Intensity",
  max: 1,
  min: 0.2,
  step: 0.05,
});

export const cell = slider({
  default: 7,
  id: "cell",
  label: "Cell",
  max: 20,
  min: 5,
  step: 1,
  unit: "px",
});

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Animate",
});

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  phosphor,
  lights,
  junk,
  mist,
  intensity,
  cell,
  animate,
];
