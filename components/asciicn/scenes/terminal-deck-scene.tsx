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

/** Retro CRT Cyberdeck OS. A live multi-pane terminal console: a rotating wireframe satellite, a scrolling hex dump, a waveform scope and system diagnostics. */
export const TerminalDeckScene = ({ className, style }: AsciiSceneProps) => (
  <AsciiShader field={FIELD} className={className} style={style} />
);
