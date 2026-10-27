import { CHARSET_NAMES } from "@/lib/ascii";
import { select, slider } from "@/lib/preview-controls";

// Knobs for the post-effects demo, shared by the page and the demo.

const amount = (id: string, label: string, value: number) =>
  slider({ default: value, id, label, max: 1, min: 0, step: 0.05 });

export const charset = select({
  default: "standard",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const scanlines = amount("scanlines", "Scanlines", 0.5);
export const bloom = amount("bloom", "Bloom", 0.6);
export const curvature = amount("curvature", "Curvature", 0.35);
export const vignette = amount("vignette", "Vignette", 0.45);
export const flicker = amount("flicker", "Flicker", 0.1);
export const glitch = amount("glitch", "Glitch", 0);

export const controls = [
  charset,
  scanlines,
  bloom,
  curvature,
  vignette,
  flicker,
  glitch,
];
