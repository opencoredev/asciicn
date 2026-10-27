import { COLOR_MODES } from "@/lib/ascii/palettes";
import { segmented, select } from "@/lib/preview-controls";

// Knobs for the scroll reveal demo, shared by the page and the demo.

export const to = segmented({
  default: "photo",
  id: "to",
  label: "Ends on",
  options: ["photo", "glyphs"],
});

export const charset = select({
  default: "sweep",
  id: "charset",
  label: "Charset",
  options: [
    "sweep",
    "standard",
    "dense",
    "blocks",
    "quadrants",
    "braille",
    "cp437",
    "petscii",
    "katakana",
    "dots",
    "edge",
  ],
});

export const colorMode = segmented({
  default: "truecolor",
  id: "colorMode",
  label: "Colour",
  options: COLOR_MODES,
});

/** Display order of the tray. */
export const controls = [to, charset, colorMode];
