import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { COLOR_MODES } from "@/lib/ascii/palettes";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the ASCII image's main demo, shared by the page and the demo.

/** The sample photos in public/examples, by knob value. */
export const PHOTOS = {
  aldrin: {
    alt: "Buzz Aldrin standing on the Moon during Apollo 11, the photographer reflected in his visor",
    ratio: 4 / 5,
    src: "/examples/aldrin.jpg",
  },
  earthrise: {
    alt: "Earth rising over the grey horizon of the Moon, seen from Apollo 8",
    ratio: 4 / 3,
    src: "/examples/earthrise.jpg",
  },
  pillars: {
    alt: "The Pillars of Creation, towers of gas and dust in the Eagle Nebula",
    ratio: 4 / 5,
    src: "/examples/pillars.jpg",
  },
  tetons: {
    alt: "The Teton Range above the winding Snake River, in black and white",
    ratio: 5 / 4,
    src: "/examples/tetons.jpg",
  },
} as const;

export const photo = segmented({
  default: "earthrise",
  id: "photo",
  label: "Photo",
  options: ["earthrise", "pillars", "tetons", "aldrin"],
});

export const charset = select({
  default: "standard",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = segmented({
  default: "truecolor",
  id: "colorMode",
  label: "Colour",
  options: COLOR_MODES,
});

export const cell = slider({
  default: 9,
  id: "cell",
  label: "Cell",
  max: 20,
  min: 6,
  step: 1,
  unit: "px",
});

export const reveal = segmented({
  default: "spotlight",
  id: "reveal",
  label: "Pointer",
  options: ["none", "spotlight", "photo"],
});

export const autoLevels = toggle({
  default: true,
  id: "autoLevels",
  label: "Auto levels",
});

/** Display order of the tray. */
export const controls = [photo, charset, colorMode, cell, reveal, autoLevels];
