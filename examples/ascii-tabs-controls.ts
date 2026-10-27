import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented } from "@/lib/preview-controls";

// Knobs for the tabs' main demo, shared by the page and the demo.

export const variant = segmented({
  default: "folder",
  id: "variant",
  label: "Variant",
  options: ["folder", "underline"],
});

export const tint = color({
  default: "orange",
  id: "color",
  label: "Active colour",
  options: ASCII_COLOR_NAMES,
});

export const size = segmented({
  default: "md",
  id: "size",
  label: "Size",
  options: ["sm", "md", "lg"],
});

/** Display order of the tray. */
export const controls = [variant, tint, size];
