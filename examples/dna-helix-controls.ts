import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { COLOR_MODES } from "@/lib/ascii/palettes";
import { segmented, select, slider } from "@/lib/preview-controls";

// Knobs for the DNA helix's main demo, shared by the page and the demo.

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

export const orientation = segmented({
  default: "horizontal",
  id: "orientation",
  label: "Axis",
  options: ["horizontal", "vertical"],
});

export const speed = slider({
  default: 0.35,
  id: "speed",
  label: "Spin",
  max: 3,
  min: -3,
  step: 0.1,
  unit: "rad/s",
});

export const twist = slider({
  default: 1,
  id: "twist",
  label: "Twist",
  max: 2.5,
  min: 0.4,
  step: 0.05,
  unit: "×",
});

export const rungs = slider({
  default: 10,
  id: "rungs",
  label: "Pairs per turn",
  max: 20,
  min: 4,
  step: 1,
});

export const cell = slider({
  default: 10,
  id: "cell",
  label: "Cell",
  max: 18,
  min: 6,
  step: 1,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  orientation,
  speed,
  twist,
  rungs,
  cell,
];
