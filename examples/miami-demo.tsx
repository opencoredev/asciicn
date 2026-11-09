"use client";

import { Miami } from "@/components/asciicn/miami";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/miami-controls";

export default function MiamiDemo() {
  return (
    <Miami
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      neon={usePreviewValue(knobs.neon)}
      cell={usePreviewValue(knobs.cell)}
      square={usePreviewValue(knobs.square)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
