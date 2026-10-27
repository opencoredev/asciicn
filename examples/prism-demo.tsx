"use client";

import { Prism } from "@/components/asciicn/prism";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/prism-controls";

export default function PrismDemo() {
  return (
    <Prism
      seed={usePreviewValue(knobs.seed)}
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
