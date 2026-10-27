import type { ASCII_BADGE_SHAPES as ASCII_BADGE_SHAPES_SOURCE } from "@/components/asciicn/ascii-badge";
import { segmented, toggle } from "@/lib/preview-controls";

// Knobs for the badge's main demo, shared by the page and the demo. The
// shape list is copied, not imported: this file runs on the server, where
// a "use client" module's exports are client references.
const ASCII_BADGE_SHAPES = [
  "square",
  "angle",
  "round",
  "pipe",
  "inverse",
] as const satisfies typeof ASCII_BADGE_SHAPES_SOURCE;

export const shape = segmented({
  default: "square",
  id: "shape",
  label: "Shape",
  options: ASCII_BADGE_SHAPES,
});

export const size = segmented({
  default: "md",
  id: "size",
  label: "Size",
  options: ["sm", "md", "lg"],
});

export const dot = toggle({
  default: true,
  id: "dot",
  label: "Live dot on running",
});

export const aligned = toggle({
  default: true,
  id: "aligned",
  label: "Fixed width",
});

/** Display order of the tray. */
export const controls = [shape, size, dot, aligned];
