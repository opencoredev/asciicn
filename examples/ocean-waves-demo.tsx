"use client";

import { OceanWaves } from "@/components/asciicn/ocean-waves";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ocean-waves-controls";

export default function OceanWavesDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <OceanWaves
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      swell={usePreviewValue(knobs.swell)}
      wind={usePreviewValue(knobs.wind)}
      moon={usePreviewValue(knobs.moon)}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
