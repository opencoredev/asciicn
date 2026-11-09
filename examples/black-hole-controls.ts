import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the black hole's main demo, shared by the page and the demo.

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

export const tint = segmented({
  default: "theme",
  id: "tint",
  label: "Tint",
  options: ["theme", "warm"],
});

export const tilt = slider({
  default: 8,
  id: "tilt",
  label: "Tilt",
  max: 40,
  min: 0,
  step: 1,
  unit: "°",
});

export const diskSize = slider({
  default: 1,
  id: "diskSize",
  label: "Disk size",
  max: 2,
  min: 0.5,
  step: 0.05,
});

export const beaming = slider({
  default: 1,
  id: "beaming",
  label: "Beaming",
  max: 2,
  min: 0,
  step: 0.1,
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

export const stars = toggle({
  default: true,
  id: "stars",
  label: "Stars",
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
  tint,
  tilt,
  diskSize,
  beaming,
  speed,
  stars,
  cell,
];
