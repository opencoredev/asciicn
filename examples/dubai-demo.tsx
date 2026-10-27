"use client";

import { Dubai } from "@/components/asciicn/dubai";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/dubai-controls";

export default function DubaiDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <Dubai
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
