import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { COLOR_MODES } from "@/lib/ascii/palettes";
import { segmented, select, slider } from "@/lib/preview-controls";

// Knobs for the image compare demo, shared by the page and the demo.

export const charset = select({
  default: "dense",
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

export const cell = slider({
  default: 9,
  id: "cell",
  label: "Cell",
  max: 18,
  min: 6,
  step: 1,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [charset, colorMode, cell];
