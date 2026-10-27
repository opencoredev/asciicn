import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the radar chart's main demo, shared by the page and the demo.

export const grid = segmented({
  default: "polygon",
  id: "grid",
  label: "Grid",
  options: ["polygon", "circle"],
});

export const firstColor = color({
  default: "blue",
  id: "color",
  label: "First series",
  options: ASCII_COLOR_NAMES,
});

export const rings = slider({
  default: 4,
  id: "rings",
  label: "Rings",
  max: 6,
  min: 2,
  step: 1,
});

export const fill = toggle({
  default: true,
  id: "fill",
  label: "Fill",
});

export const interactive = toggle({
  default: true,
  id: "interactive",
  label: "Interactive",
});

/** Display order of the tray. */
export const controls = [grid, firstColor, rings, fill, interactive];
