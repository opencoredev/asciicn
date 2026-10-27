import { segmented, toggle } from "@/lib/preview-controls";

// Knobs for the status dot's main demo, shared by the page and the demo.

export const status = segmented({
  default: "online",
  id: "status",
  label: "Your status",
  options: ["online", "busy", "offline", "error"],
});

export const variant = segmented({
  default: "dot",
  id: "variant",
  label: "Glyphs",
  options: ["dot", "braille"],
});

export const size = segmented({
  default: "md",
  id: "size",
  label: "Size",
  options: ["sm", "md", "lg"],
});

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Animate",
});

/** Display order of the tray. */
export const controls = [status, variant, size, animate];
