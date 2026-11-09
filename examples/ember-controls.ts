import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { select, slider } from "@/lib/preview-controls";

// Knobs for the ember main demo, shared by the page and the demo.

export const charset = select({
  default: "standard",
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

export const intensity = slider({
  default: 1,
  id: "intensity",
  label: "Intensity",
  max: 2,
  min: 0.2,
  step: 0.05,
});

export const wind = slider({
  default: 0.2,
  id: "wind",
  label: "Wind",
  max: 1,
  min: -1,
  step: 0.05,
});

export const sparks = slider({
  default: 0.5,
  id: "sparks",
  label: "Sparks",
  max: 1,
  min: 0,
  step: 0.05,
});

export const speed = slider({
  default: 1,
  id: "speed",
  label: "Speed",
  max: 3,
  min: 0,
  step: 0.1,
  unit: "×",
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
  intensity,
  wind,
  sparks,
  speed,
  cell,
];
