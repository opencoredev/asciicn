"use client";

import { CanyonRiver } from "@/components/asciicn/canyon-river";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/canyon-river-controls";

export default function CanyonRiverDemo() {
  return (
    <CanyonRiver
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      stars={usePreviewValue(knobs.stars)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
