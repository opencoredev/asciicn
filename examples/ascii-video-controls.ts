import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { COLOR_MODES } from "@/lib/ascii/palettes";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the ASCII video's main demo, shared by the page and the demo.

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

export const cell = slider({
  default: 9,
  id: "cell",
  label: "Cell",
  max: 18,
  min: 6,
  step: 1,
  unit: "px",
});

export const fps = slider({
  default: 30,
  id: "fps",
  label: "Sampling",
  max: 60,
  min: 12,
  step: 6,
  unit: "fps",
});

export const mirror = toggle({ default: false, id: "mirror", label: "Mirror" });

/** Display order of the tray. */
export const controls = [charset, colorMode, cell, fps, mirror];
