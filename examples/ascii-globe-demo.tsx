"use client";

import { AsciiGlobe } from "@/components/asciicn/ascii-globe";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-globe-controls";
import { OFFICES, ROUTES } from "@/examples/dot-map-data";

export default function AsciiGlobeDemo() {
  const color = usePreviewValue(knobs.ink);
  const accent = usePreviewValue(knobs.accent);
  const speed = usePreviewValue(knobs.speed);
  const tilt = usePreviewValue(knobs.tilt);
  const cell = usePreviewValue(knobs.cell);
  const arcs = usePreviewValue(knobs.arcs);
  const animate = usePreviewValue(knobs.animate);

  return (
    <AsciiGlobe
      color={color}
      accent={accent}
      speed={speed}
      tilt={tilt}
      cell={cell}
      markers={OFFICES}
      arcs={arcs ? ROUTES : undefined}
      animate={animate}
      className="absolute inset-0"
    />
  );
}
