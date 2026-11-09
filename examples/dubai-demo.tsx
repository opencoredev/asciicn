"use client";

import { Dubai } from "@/components/asciicn/dubai";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/dubai-controls";

export default function DubaiDemo() {
  return (
    <Dubai
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      square={usePreviewValue(knobs.square)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
