"use client";

import { AsciiOrb } from "@/components/asciicn/ascii-orb";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-orb-controls";
import { toward } from "@/examples/background-tint";

export default function AsciiOrbDemo() {
  const color = usePreviewValue(knobs.ink);
  const size = usePreviewValue(knobs.size);
  const morph = usePreviewValue(knobs.morph);
  const lean = usePreviewValue(knobs.lean);
  const cell = usePreviewValue(knobs.cell);
  const shine = usePreviewValue(knobs.shine);
  const animate = usePreviewValue(knobs.animate);

  return (
    <AsciiOrb
      color={color}
      highlight={shine ? toward(color, 30, "#fff") : undefined}
      size={size}
      morph={morph}
      lean={lean}
      cell={cell}
      animate={animate}
      className="absolute inset-0"
    />
  );
}
