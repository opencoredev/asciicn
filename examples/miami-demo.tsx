"use client";

import { Miami } from "@/components/asciicn/miami";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/miami-controls";

export default function MiamiDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <Miami
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      ramp={usePreviewValue(knobs.ramp)}
      intensity={usePreviewValue(knobs.intensity)}
      neon={usePreviewValue(knobs.neon)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
