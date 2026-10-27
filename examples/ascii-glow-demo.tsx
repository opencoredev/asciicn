"use client";

import { AsciiGlow } from "@/components/asciicn/ascii-glow";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-glow-controls";

export default function AsciiGlowDemo() {
  const position = usePreviewValue(knobs.position);
  const charset = usePreviewValue(knobs.charset);
  const color = usePreviewValue(knobs.tint);
  const radius = usePreviewValue(knobs.radius);
  const intensity = usePreviewValue(knobs.intensity);

  return (
    <AsciiGlow
      position={position}
      charset={charset}
      color={color}
      radius={radius}
      intensity={intensity}
      className="absolute inset-0"
    />
  );
}
