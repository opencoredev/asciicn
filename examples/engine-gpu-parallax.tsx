"use client";

import { AsciiShader } from "@/lib/ascii/shader";

// Fields can read the pointer themselves: three layers of rings slide by
// different amounts, so the scene tilts as the pointer moves.
const FIELD = `
float parallaxRings(vec2 p, float scale) {
  return smoothstep(0.12, 0.0, abs(fract(length(p) * scale) - 0.5));
}

float field(vec2 uv, vec2 res, float t) {
  vec2 p = (uv - 0.5) * vec2(res.x / res.y, 1.0);
  vec2 tilt = (u_pointer.xy - 0.5) * u_pointer.z;
  float far = parallaxRings(p - tilt * 0.03, 6.0) * 0.3;
  float mid = parallaxRings(p - tilt * 0.08 + vec2(0.2, 0.0), 4.0) * 0.6;
  float near = parallaxRings(p - tilt * 0.16 - vec2(0.25, 0.1), 2.5);
  return max(far, max(mid, near));
}
`;

export default function EngineGpuParallax() {
  return (
    <AsciiShader
      field={FIELD}
      charset="braille"
      palette={["--ascii-paper", "--ascii-ink"]}
      fps={60}
      className="absolute inset-0"
    />
  );
}
