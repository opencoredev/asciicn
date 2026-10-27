"use client";

import { HongKong } from "@/components/asciicn/hong-kong";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/hong-kong-controls";

export default function HongKongDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <HongKong
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      lights={usePreviewValue(knobs.lights)}
      waves={usePreviewValue(knobs.waves)}
      boats={usePreviewValue(knobs.boats)}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
