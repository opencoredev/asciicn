"use client";

import { AsciiShader } from "@/lib/ascii/shader";

// The ripples from step 3, coloured by a second function: hue turns with
// the distance from the drop, in OKLCH so every hue reads equally bright.
const FIELD = `
float field(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float wobble = fbm(p * 2.2 + vec2(t * 0.03, 0.0)) - 0.5;
  float d = length(p - vec2(0.5 * aspect, 0.55)) + wobble * 0.08;
  return 0.85 * (0.5 + 0.5 * cos(d * 46.0 - t * 0.9)) * exp(-d * 2.6);
}
`;

const COLOR = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  float d = length(vec2(uv.x * aspect, uv.y) - vec2(0.5 * aspect, 0.55));
  return toSrgb(oklch(0.78, 0.14, d * 9.0 - t * 0.4));
}
`;

export default function EngineGpuColor() {
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR}
      charset="dense"
      stillTime={4}
      className="absolute inset-0"
    />
  );
}
