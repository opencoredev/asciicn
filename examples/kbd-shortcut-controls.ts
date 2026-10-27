import { segmented, select, toggle } from "@/lib/preview-controls";

// Knobs for the keycaps' main demo, shared by the page and the demo.

export const keys = select({
  default: "mod+shift+p",
  id: "keys",
  label: "Shortcut",
  options: ["mod+shift+p", "mod+k", "alt+enter", "shift+tab", "g i", "esc"],
});

export const variant = segmented({
  default: "cap",
  id: "variant",
  label: "Variant",
  options: ["cap", "inline"],
});

export const platform = segmented({
  default: "auto",
  id: "platform",
  label: "Platform",
  options: ["auto", "mac", "pc"],
});

export const size = segmented({
  default: "lg",
  id: "size",
  label: "Size",
  options: ["sm", "md", "lg"],
});

export const listen = toggle({
  default: true,
  id: "listen",
  label: "Press with the keyboard",
});

/** Display order of the tray. */
export const controls = [keys, variant, platform, size, listen];
