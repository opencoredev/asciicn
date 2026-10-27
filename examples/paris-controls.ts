import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the Paris main demo, shared by the page and the demo.

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
  max: 1,
  min: 0,
  step: 0.05,
});

export const sparkle = slider({
  default: 0.3,
  id: "sparkle",
  label: "Sparkle",
  max: 1,
  min: 0,
  step: 0.05,
});

export const clouds = slider({
  default: 0.5,
  id: "clouds",
  label: "Clouds",
  max: 1,
  min: 0,
  step: 0.05,
});

export const beacon = toggle({
  default: true,
  id: "beacon",
  label: "Beacon",
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

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Animate",
});

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  intensity,
  sparkle,
  clouds,
  beacon,
  cell,
  animate,
];
