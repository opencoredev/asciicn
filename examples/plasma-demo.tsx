"use client";

import { Plasma } from "@/components/asciicn/plasma";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/plasma-controls";

export default function PlasmaDemo() {
  return (
    <Plasma
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      scale={usePreviewValue(knobs.scale)}
      warp={usePreviewValue(knobs.warp)}
      bands={usePreviewValue(knobs.bands)}
      crest={usePreviewValue(knobs.crest)}
      intensity={usePreviewValue(knobs.intensity)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
