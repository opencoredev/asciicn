"use client";

import { Ionize } from "@/components/asciicn/ionize";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ionize-controls";

export default function IonizeDemo() {
  return (
    <Ionize
      seed={usePreviewValue(knobs.seed)}
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
