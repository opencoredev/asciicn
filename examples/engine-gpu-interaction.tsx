"use client";

import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/engine-gpu-interaction-controls";
import { AsciiShader } from "@/lib/ascii/shader";

// Soft drifting noise, so the pointer's effect is easy to see. Move over
// it, or click for ripples.
const FIELD = `
float field(vec2 uv, vec2 res, float t) {
  vec2 p = uv * vec2(res.x / res.y, 1.0) * 2.4;
  return smoothstep(0.35, 0.8, fbm(p + vec2(t * 0.05, t * 0.02)));
}
`;

export default function EngineGpuInteraction() {
  return (
    <AsciiShader
      field={FIELD}
      interaction={usePreviewValue(knobs.interaction)}
      charset={usePreviewValue(knobs.charset)}
      palette={["--ascii-paper", "--ascii-ink"]}
      fps={60}
      className="absolute inset-0"
    />
  );
}
