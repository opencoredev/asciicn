"use client";

import { MountainDusk } from "@/components/asciicn/mountain-dusk";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/mountain-dusk-controls";

export default function MountainDuskDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <MountainDusk
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      time={usePreviewValue(knobs.time)}
      layers={usePreviewValue(knobs.layers)}
      stars={usePreviewValue(knobs.stars)}
      mist={usePreviewValue(knobs.mist)}
      moon={usePreviewValue(knobs.moon)}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
