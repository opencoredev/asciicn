import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the logo marquee's main demo, shared by the page and the demo.

export const speed = slider({
  default: 8,
  id: "speed",
  label: "Speed",
  max: 24,
  min: 2,
  step: 2,
  unit: " cells/s",
});

export const charset = select({
  default: "quadrants",
  id: "charset",
  label: "Charset",
  options: ["quadrants", "braille", "blocks", "standard", "dots"],
});

export const rows = slider({
  default: 6,
  id: "rows",
  label: "Rows",
  max: 10,
  min: 3,
  step: 1,
});

export const direction = segmented({
  default: "left",
  id: "direction",
  label: "Direction",
  options: ["left", "right"],
});

export const fade = toggle({
  default: true,
  id: "fade",
  label: "Edge fade",
});

export const ink = color({
  default: "grey",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

/** Display order of the tray. */
export const controls = [speed, charset, rows, direction, fade, ink];
