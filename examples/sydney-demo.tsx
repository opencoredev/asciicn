"use client";

import { Sydney } from "@/components/asciicn/sydney";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/sydney-controls";

export default function SydneyDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <Sydney
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      fireworks={usePreviewValue(knobs.fireworks)}
      ferry={usePreviewValue(knobs.ferry)}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
