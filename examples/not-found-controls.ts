import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the not-found page's main demo, shared by the page and the demo.

export const code = segmented({
  default: "404",
  id: "code",
  label: "Code",
  options: ["404", "410", "500"],
});

export const charset = select({
  default: "braille",
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

export const accent = color({
  default: "orange",
  id: "accent",
  label: "Accent",
  options: ASCII_COLOR_NAMES,
});

export const wind = slider({
  default: 1,
  id: "wind",
  label: "Wind",
  max: 2,
  min: 0,
  step: 0.1,
  unit: "×",
});

export const cell = slider({
  default: 10,
  id: "cell",
  label: "Cell",
  max: 16,
  min: 6,
  step: 1,
  unit: "px",
});

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Animate",
});

/** Display order of the tray. */
export const controls = [code, charset, colorMode, accent, wind, cell, animate];
