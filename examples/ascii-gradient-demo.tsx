"use client";

import { AsciiGradient } from "@/components/asciicn/ascii-gradient";
import type { GradientShape } from "@/components/asciicn/ascii-gradient";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-gradient-controls";

export default function AsciiGradientDemo() {
  const mode = usePreviewValue(knobs.mode);
  const color = usePreviewValue(knobs.ink);
  const matrix = usePreviewValue(knobs.matrix);
  const cell = usePreviewValue(knobs.cell);
  const to = usePreviewValue(knobs.strength);
  const noise = usePreviewValue(knobs.noise);
  const animate = usePreviewValue(knobs.animate);

  const shape: GradientShape =
    mode === "radial"
      ? { center: [0.5, 1], mode, radius: 0.8 }
      : { angle: mode === "linear" ? 160 : 210, mode };

  return (
    <AsciiGradient
      {...shape}
      palette={["--ascii-paper", color]}
      matrix={matrix}
      cell={cell}
      // Radial glows out from the centre: ink there, paper at the rim.
      from={mode === "radial" ? to : 0}
      to={mode === "radial" ? 0 : to}
      noise={noise}
      animate={animate}
      className="absolute inset-0"
    />
  );
}
