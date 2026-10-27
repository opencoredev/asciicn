"use client";

import { Beams } from "@/components/asciicn/beams";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/beams-controls";

export default function BeamsDemo() {
  const tint = usePreviewValue(knobs.tint);
  const rays = usePreviewValue(knobs.rays);
  const spread = usePreviewValue(knobs.spread);
  const animate = usePreviewValue(knobs.animate);

  return (
    <Beams
      palette={["--ascii-paper", tint]}
      rays={rays}
      spread={spread}
      animate={animate}
      className="absolute inset-0"
    />
  );
}
