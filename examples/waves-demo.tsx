"use client";

import { Waves } from "@/components/asciicn/waves";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/waves-controls";

export default function WavesDemo() {
  return (
    <Waves
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      farColor={usePreviewValue(knobs.far)}
      variant={usePreviewValue(knobs.variant)}
      layers={usePreviewValue(knobs.layers)}
      amplitude={usePreviewValue(knobs.amplitude)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
