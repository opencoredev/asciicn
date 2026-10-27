"use client";

import { AsciiGlow } from "@/components/asciicn/ascii-glow";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-glow-controls";

export default function AsciiGlowDemo() {
  const tint = usePreviewValue(knobs.tint);
  const position = usePreviewValue(knobs.position);
  const intensity = usePreviewValue(knobs.intensity);
  const radius = usePreviewValue(knobs.radius);
  const animate = usePreviewValue(knobs.animate);

  return (
    <AsciiGlow
      palette={["--ascii-paper", tint]}
      position={position}
      intensity={intensity}
      radius={radius}
      animate={animate}
      className="absolute inset-0"
    />
  );
}
