import { CHARSET_NAMES, COLOR_MODES, PHOSPHOR_NAMES } from "@/lib/ascii";
import { select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the retro computer's main demo, shared by the page and the demo.

export const charset = select({
  default: "braille",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = select({
  default: "truecolor",
  id: "colorMode",
  label: "Colour",
  options: COLOR_MODES,
});

export const screen = select({
  default: "p3",
  id: "screen",
  label: "Screen phosphor",
  options: PHOSPHOR_NAMES,
});

export const typing = slider({
  default: 0.06,
  id: "typing",
  label: "Seconds per key",
  max: 0.2,
  min: 0.02,
  step: 0.01,
  unit: "s",
});

export const cell = slider({
  default: 11,
  id: "cell",
  label: "Cell",
  max: 16,
  min: 7,
  step: 1,
  unit: "px",
});

export const interactive = toggle({
  default: true,
  id: "interactive",
  label: "Drag to turn",
});

/** Display order of the tray. */
export const controls = [charset, colorMode, screen, typing, cell, interactive];
