"use client";

import { RedwoodLight } from "@/components/asciicn/redwood-light";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/redwood-light-controls";

export default function RedwoodLightDemo() {
  return (
    <RedwoodLight
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      motes={usePreviewValue(knobs.motes)}
      mist={usePreviewValue(knobs.mist)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
