import type { ASCII_BOX_FRAMES as ASCII_BOX_FRAMES_SOURCE } from "@/components/asciicn/ascii-box";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const ASCII_BOX_FRAMES = [
  "light",
  "heavy",
  "double",
  "rounded",
  "ascii",
] as const satisfies typeof ASCII_BOX_FRAMES_SOURCE;

// Knobs for the box's main demo, shared by the page and the demo.

export const frame = segmented({
  default: "rounded",
  id: "frame",
  label: "Frame",
  options: ASCII_BOX_FRAMES,
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const align = segmented({
  default: "start",
  id: "align",
  label: "Labels",
  options: ["start", "center", "end"],
});

export const shadow = segmented({
  default: "light",
  id: "shadow",
  label: "Shadow",
  options: ["none", "light", "medium", "dark"],
});

export const padding = slider({
  default: 1,
  id: "padding",
  label: "Padding",
  max: 3,
  min: 0,
  step: 1,
  unit: "rows",
});

export const filled = toggle({
  default: false,
  id: "filled",
  label: "Filled",
});

/** Display order of the tray. */
export const controls = [frame, tint, align, shadow, padding, filled];
