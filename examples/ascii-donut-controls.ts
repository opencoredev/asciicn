import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { COLOR_MODES } from "@/lib/ascii/palettes";
import { segmented, select, slider } from "@/lib/preview-controls";

// Knobs for the ASCII donut's main demo, shared by the page and the demo.

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

export const surface = segmented({
  default: "smooth",
  id: "surface",
  label: "Surface",
  options: ["smooth", "ribbed"],
});

export const thickness = slider({
  default: 0.46,
  id: "thickness",
  label: "Thickness",
  max: 0.8,
  min: 0.15,
  step: 0.01,
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
  default: 10,
  id: "cell",
  label: "Cell",
  max: 18,
  min: 6,
  step: 1,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [charset, colorMode, surface, thickness, speed, cell];
