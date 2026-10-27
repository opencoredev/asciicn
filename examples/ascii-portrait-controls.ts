import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the ASCII portrait's main demo, shared by the page and the demo.

/** The sample portraits in public/examples, by knob value. */
export const PORTRAITS = {
  lincoln: {
    alt: "Abraham Lincoln in 1863, facing the camera, in a dark coat and bow tie",
    src: "/examples/lincoln.jpg",
  },
  ride: {
    alt: "Astronaut Sally Ride in 1984, smiling, in a navy NASA shirt",
    src: "/examples/ride.jpg",
  },
} as const;

export const photo = segmented({
  default: "lincoln",
  id: "photo",
  label: "Photo",
  options: ["lincoln", "ride"],
});

export const charset = select({
  default: "braille",
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

export const cell = slider({
  default: 8,
  id: "cell",
  label: "Cell",
  max: 16,
  min: 6,
  step: 1,
  unit: "px",
});

export const detail = slider({
  default: 0.5,
  id: "detail",
  label: "Detail",
  max: 1,
  min: 0,
  step: 0.05,
});

export const edges = toggle({
  default: true,
  id: "edges",
  label: "Contour strokes",
});

export const compare = segmented({
  default: "hover",
  id: "compare",
  label: "Split",
  options: ["hover", "drag", "none"],
});

/** Display order of the tray. */
export const controls = [
  photo,
  charset,
  colorMode,
  cell,
  detail,
  edges,
  compare,
];
