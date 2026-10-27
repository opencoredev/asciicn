import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, slider } from "@/lib/preview-controls";

// Knobs for the uptime bar's main demo, shared by the page and the demo.

export const up = color({
  default: "green",
  id: "color",
  label: "Up colour",
  options: ASCII_COLOR_NAMES,
});

export const rows = slider({
  default: 2,
  id: "rows",
  label: "Rows",
  max: 4,
  min: 1,
  step: 1,
  unit: "",
});

export const maxCell = slider({
  default: 16,
  id: "max-cell",
  label: "Max cell",
  max: 24,
  min: 10,
  step: 1,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [up, rows, maxCell];
