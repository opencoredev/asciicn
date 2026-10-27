import { ASCII_BOX_FRAMES } from "@/components/asciicn/ascii-box";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, select, toggle } from "@/lib/preview-controls";

// Knobs for the ASCII card demo, shared by the page and the demo.

export const frame = segmented({
  default: "rounded",
  id: "frame",
  label: "Frame",
  options: ASCII_BOX_FRAMES,
});

export const glow = select({
  default: "top-right",
  id: "glow",
  label: "Glow",
  options: [
    "none",
    "top",
    "top-right",
    "top-left",
    "bottom",
    "bottom-right",
    "center",
  ],
});

export const glowCharset = select({
  default: "standard",
  id: "glowCharset",
  label: "Glow glyphs",
  options: ["standard", "dense", "blocks", "braille", "dots", "katakana"],
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const interactive = toggle({
  default: true,
  id: "interactive",
  label: "Interactive",
});

/** Display order of the tray. */
export const controls = [frame, glow, glowCharset, tint, interactive];
