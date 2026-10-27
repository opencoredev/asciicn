import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, select, toggle } from "@/lib/preview-controls";

// Knobs for the divider's main demo, shared by the page and the demo.

export const variant = select({
  default: "light",
  id: "variant",
  label: "Variant",
  options: [
    "light",
    "heavy",
    "double",
    "dashed",
    "ascii",
    "dots",
    "beads",
    "diamonds",
  ],
});

export const align = segmented({
  default: "center",
  id: "align",
  label: "Label",
  options: ["start", "center", "end"],
});

export const showLabel = toggle({
  default: true,
  id: "label",
  label: "Show label",
});

export const tint = color({
  default: "grey",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

/** Display order of the tray. */
export const controls = [variant, align, showLabel, tint];
