"use client";

import { AsciiShader } from "@/lib/ascii/shader";

// Step 1: the tone is just the height. 0 at the bottom (paper), 1 at the top (ink).
const FIELD = `
float field(vec2 uv, vec2 res, float t) {
  return uv.y;
}
`;

export default function EngineFieldTone() {
  return (
    <AsciiShader
      field={FIELD}
      animate={false}
      palette={["--ascii-paper", "blue"]}
      className="absolute inset-0"
    />
  );
}
