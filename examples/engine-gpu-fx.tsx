"use client";

import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/engine-gpu-fx-controls";
import { AsciiShader } from "@/lib/ascii/shader";

// A slow plasma on a P1 green phosphor, with every post effect on a knob.
const FIELD = `
float field(vec2 uv, vec2 res, float t) {
  vec2 p = (uv - 0.5) * vec2(res.x / res.y, 1.0) * 3.0;
  float v = sin(p.x * 1.3 + t * 0.6) + sin(p.y * 1.7 - t * 0.4);
  v += sin(length(p + vec2(sin(t * 0.3), cos(t * 0.2))) * 2.4 - t);
  return smoothstep(-0.6, 2.6, v + fbm(p * 0.6 + t * 0.05));
}
`;

export default function EngineGpuFx() {
  return (
    <AsciiShader
      field={FIELD}
      phosphor="p1"
      charset={usePreviewValue(knobs.charset)}
      fx={{
        bloom: usePreviewValue(knobs.bloom),
        curvature: usePreviewValue(knobs.curvature),
        flicker: usePreviewValue(knobs.flicker),
        glitch: usePreviewValue(knobs.glitch),
        scanlines: usePreviewValue(knobs.scanlines),
        vignette: usePreviewValue(knobs.vignette),
      }}
      stillTime={3}
      className="absolute inset-0"
    />
  );
}
