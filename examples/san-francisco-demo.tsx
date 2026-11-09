"use client";

import { SanFrancisco } from "@/components/asciicn/san-francisco";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/san-francisco-controls";

export default function SanFranciscoDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <SanFrancisco
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      ramp={usePreviewValue(knobs.ramp)}
      intensity={usePreviewValue(knobs.intensity)}
      fog={usePreviewValue(knobs.fog)}
      traffic={usePreviewValue(knobs.traffic)}
      boat={usePreviewValue(knobs.boat)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
