"use client";

import { Sydney } from "@/components/asciicn/sydney";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/sydney-controls";

export default function SydneyDemo() {
  return (
    <Sydney
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      ferry={usePreviewValue(knobs.ferry)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
