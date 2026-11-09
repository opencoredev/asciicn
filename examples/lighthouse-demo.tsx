"use client";

import { Lighthouse } from "@/components/asciicn/lighthouse";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/lighthouse-controls";

export default function LighthouseDemo() {
  return (
    <Lighthouse
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      stars={usePreviewValue(knobs.stars)}
      clouds={usePreviewValue(knobs.clouds)}
      square={usePreviewValue(knobs.square)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
