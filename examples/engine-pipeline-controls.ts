import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { segmented, select, toggle } from "@/lib/preview-controls";

// Knobs for the engine overview demo, shared by the page and the demo.

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

export const dither = toggle({
  default: false,
  id: "dither",
  label: "Dither levels",
});

export const invert = toggle({
  default: false,
  id: "invert",
  label: "Invert",
});

/** Display order of the tray. */
export const controls = [charset, colorMode, dither, invert];
