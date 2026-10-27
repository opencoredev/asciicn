import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the progress bar's main demo, shared by the page and the demo.

export const track = segmented({
  default: "shade",
  id: "track",
  label: "Track",
  options: ["shade", "dots", "line", "none"],
});

export const tint = color({
  default: "blue",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const size = segmented({
  default: "md",
  id: "size",
  label: "Size",
  options: ["sm", "md", "lg"],
});

export const segments = slider({
  default: 0,
  id: "segments",
  label: "Segments (0 is continuous)",
  max: 12,
  min: 0,
  step: 2,
});

export const indeterminate = toggle({
  default: false,
  id: "indeterminate",
  label: "Indeterminate",
});

/** Display order of the tray. */
export const controls = [track, tint, size, segments, indeterminate];
