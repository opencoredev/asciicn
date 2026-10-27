"use client";

import type { AsciiSceneProps } from "@/lib/ascii/scene";
// Placeholder until the scene lands: a quiet vertical ramp, so the
// gallery, Studio and docs can mount it.
import { AsciiShader } from "@/lib/ascii/shader";

const FIELD = `
float field(vec2 uv, vec2 res, float t) {
  return 0.15 + 0.35 * uv.y + 0.1 * sin(uv.x * 9.0 + t);
}
`;

/** Outrun Wireframe Horizon. Scrolling wireframe mountains under a segmented retro sun, with starlight and scanlines over a perspective grid. */
export const SynthwaveHorizonScene = ({
  className,
  style,
}: AsciiSceneProps) => (
  <AsciiShader field={FIELD} className={className} style={style} />
);
