"use client";

import { Paris } from "@/components/asciicn/paris";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/paris-controls";

export default function ParisDemo() {
  return (
    <Paris
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      beacon={usePreviewValue(knobs.beacon)}
      boat={usePreviewValue(knobs.boat)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
