import { DISSOLVE_ORDERS } from "@/components/asciicn/dissolve-text";
import { select, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the dissolve text demo, shared by the page and the demo.

export const charset = select({
  default: "blocks",
  id: "charset",
  label: "Ramp",
  options: ["blocks", "braille", "quadrants", "dots", "standard", "petscii"],
});

export const order = segmented({
  default: "start",
  id: "order",
  label: "Order",
  options: DISSOLVE_ORDERS,
});

export const by = segmented({
  default: "char",
  id: "by",
  label: "By",
  options: ["char", "word"],
});

export const duration = slider({
  default: 450,
  id: "duration",
  label: "Duration",
  max: 1200,
  min: 150,
  step: 50,
  unit: "ms",
});

export const show = toggle({
  default: true,
  id: "show",
  label: "Show",
});

/** Display order of the tray. */
export const controls = [charset, order, by, duration, show];
