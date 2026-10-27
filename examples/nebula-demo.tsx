"use client";

import { Nebula } from "@/components/asciicn/nebula";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/nebula-controls";

export default function NebulaDemo() {
  return (
    <Nebula
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
