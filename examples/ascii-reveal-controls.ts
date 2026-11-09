import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { segmented, select, slider } from "@/lib/preview-controls";

// Knobs for the ASCII reveal's main demo, shared by the page and the demo.

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
  options: ["aldrin", "earthrise", "pillars", "tetons"],
});

/** `loop` is the demo's own: a manual reveal it plays back and forth. */
export const trigger = segmented({
  default: "loop",
  id: "trigger",
  label: "Trigger",
  options: ["loop", "view", "hover"],
});

export const direction = select({
  default: "down",
  id: "direction",
  label: "Direction",
  // The component's REVEAL_DIRECTIONS, copied: this file also runs on the server.
  options: ["down", "up", "left", "right", "radial", "random"],
});

export const charset = select({
  default: "standard",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = segmented({
  default: "mono",
  id: "colorMode",
  label: "Colour",
  options: ["mono", "truecolor", "duotone"],
});

export const duration = slider({
  default: 2400,
  id: "duration",
  label: "Duration",
  max: 5000,
  min: 800,
  step: 100,
  unit: "ms",
});

export const cell = slider({
  default: 9,
  id: "cell",
  label: "Cell",
  max: 16,
  min: 6,
  step: 1,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [
  photo,
  trigger,
  direction,
  charset,
  colorMode,
  duration,
  cell,
];
