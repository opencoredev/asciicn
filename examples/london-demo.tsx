"use client";

import { London } from "@/components/asciicn/london";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/london-controls";

export default function LondonDemo() {
  return (
    <London
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      fog={usePreviewValue(knobs.fog)}
      bus={usePreviewValue(knobs.bus)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
