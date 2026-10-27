import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider } from "@/lib/preview-controls";

// Knobs for the stat card's main demo, shared by the page and the demo.

export const frame = segmented({
  default: "rounded",
  id: "frame",
  label: "Frame",
  options: ["rounded", "light", "heavy", "double", "ascii"],
});

export const tint = color({
  default: "blue",
  id: "color",
  label: "Sparkline",
  options: ASCII_COLOR_NAMES,
});

export const trendRows = slider({
  default: 2,
  id: "trend-rows",
  label: "Sparkline rows",
  max: 4,
  min: 1,
  step: 1,
});

export const good = segmented({
  default: "up",
  id: "good",
  label: "Good direction",
  options: ["up", "down"],
});

/** Display order of the tray. */
export const controls = [frame, tint, trendRows, good];
