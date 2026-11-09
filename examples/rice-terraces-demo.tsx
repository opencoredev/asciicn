"use client";

import { RiceTerraces } from "@/components/asciicn/rice-terraces";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/rice-terraces-controls";

export default function RiceTerracesDemo() {
  return (
    <RiceTerraces
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      bird={usePreviewValue(knobs.bird)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
