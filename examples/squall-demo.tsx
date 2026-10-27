"use client";

import { Squall } from "@/components/asciicn/squall";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/squall-controls";

export default function SquallDemo() {
  return (
    <Squall
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
