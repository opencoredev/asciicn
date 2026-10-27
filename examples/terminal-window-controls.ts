import type { ASCII_BOX_FRAMES as ASCII_BOX_FRAMES_SOURCE } from "@/components/asciicn/ascii-box";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the terminal window's main demo, shared by the page and the
// demo. The frame list is copied, not imported: this file runs on the
// server, where a "use client" module's exports are client references.
const ASCII_BOX_FRAMES = [
  "light",
  "heavy",
  "double",
  "rounded",
  "ascii",
] as const satisfies typeof ASCII_BOX_FRAMES_SOURCE;

export const speed = slider({
  default: 1,
  id: "speed",
  label: "Speed",
  max: 3,
  min: 0.5,
  step: 0.25,
  unit: "x",
});

export const loop = toggle({
  default: true,
  id: "loop",
  label: "Loop",
});

export const frame = segmented({
  default: "rounded",
  id: "frame",
  label: "Frame",
  options: ASCII_BOX_FRAMES,
});

export const size = segmented({
  default: "lg",
  id: "size",
  label: "Size",
  options: ["sm", "md", "lg"],
});

export const tint = color({
  default: "grey",
  id: "color",
  label: "Frame colour",
  options: ASCII_COLOR_NAMES,
});

/** Display order of the tray. */
export const controls = [speed, loop, frame, size, tint];
