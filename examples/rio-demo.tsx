"use client";

import { Rio } from "@/components/asciicn/rio";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/rio-controls";

export default function RioDemo() {
  return (
    <Rio
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      surf={usePreviewValue(knobs.surf)}
      birds={usePreviewValue(knobs.birds)}
      cableCar={usePreviewValue(knobs.cableCar)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
