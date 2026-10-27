import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { COLOR_MODES } from "@/lib/ascii/palettes";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the cyber skull's main demo, shared by the page and the demo.

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

export const shading = segmented({
  default: "both",
  id: "shading",
  label: "Shading",
  options: ["solid", "wire", "both"],
});

export const surface = segmented({
  default: "faceted",
  id: "surface",
  label: "Surface",
  options: ["faceted", "smooth"],
});

export const speed = slider({
  default: 0.3,
  id: "speed",
  label: "Spin",
  max: 3,
  min: -3,
  step: 0.1,
  unit: "rad/s",
});

export const jaw = toggle({
  default: true,
  id: "jaw",
  label: "Jaw",
});

export const scan = toggle({
  default: true,
  id: "scan",
  label: "Scan",
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
  shading,
  surface,
  speed,
  jaw,
  scan,
  cell,
];
