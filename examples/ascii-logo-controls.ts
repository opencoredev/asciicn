import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { ASCII_COLOR_NAMES } from "@/lib/ascii/tokens";
import { color, segmented, select, slider } from "@/lib/preview-controls";

// Knobs for the ASCII logo's main demo, shared by the page and the demo.

export const logo = select({
  default: "Halcyra",
  id: "logo",
  label: "Logo",
  options: [
    "Halcyra",
    "Quillwork",
    "Orbitline",
    "Ferrovane",
    "Lumenade",
    "Northpine",
    "Vantor",
    "Cobaltic",
  ],
});

export const charset = select({
  default: "braille",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const effect = segmented({
  default: "shimmer",
  id: "effect",
  label: "Effect",
  options: ["none", "shimmer", "scan", "reveal"],
});

export const ink = color({
  default: "ink",
  id: "color",
  label: "Ink",
  options: ASCII_COLOR_NAMES,
});

export const colorMode = segmented({
  default: "mono",
  id: "colorMode",
  label: "Colour",
  options: ["mono", "duotone", "palette"],
});

export const cell = slider({
  default: 8,
  id: "cell",
  label: "Cell",
  max: 16,
  min: 4,
  step: 1,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [logo, charset, effect, ink, colorMode, cell];
