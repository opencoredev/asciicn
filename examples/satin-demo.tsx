"use client";

import { Satin } from "@/components/asciicn/satin";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/satin-controls";

export default function SatinDemo() {
  return (
    <Satin
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
