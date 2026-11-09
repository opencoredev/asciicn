import type { GlyphRainColorMode } from "@/components/asciicn/glyph-rain";
import { CHARSET_NAMES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the glyph rain's main demo, shared by the page and the demo.
// The page imports this on the server, so the colour modes are copied
// here rather than imported from the client component.
const COLOR_MODES = [
  "truecolor",
  "mono",
  "duotone",
] as const satisfies readonly GlyphRainColorMode[];

export const message = select({
  default: "asciicn",
  id: "message",
  label: "Message",
  options: ["asciicn", "hello world", "ship it", "none"],
});

export const charset = select({
  default: "latin",
  id: "charset",
  label: "Charset",
  options: ["latin", ...CHARSET_NAMES],
});

export const colorMode = segmented({
  default: "truecolor",
  id: "colorMode",
  label: "Colour mode",
  options: COLOR_MODES,
});

export const density = slider({
  default: 0.5,
  id: "density",
  label: "Density",
  max: 1,
  min: 0.1,
  step: 0.05,
});

export const speed = slider({
  default: 1,
  id: "speed",
  label: "Speed",
  max: 3,
  min: 0.2,
  step: 0.1,
  unit: "×",
});

export const hold = slider({
  default: 5,
  id: "hold",
  label: "Hold",
  max: 12,
  min: 1,
  step: 0.5,
  unit: "s",
});

export const loop = toggle({
  default: true,
  id: "loop",
  label: "Loop",
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 20,
  min: 8,
  step: 1,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [
  message,
  charset,
  colorMode,
  density,
  speed,
  hold,
  loop,
  cell,
];
