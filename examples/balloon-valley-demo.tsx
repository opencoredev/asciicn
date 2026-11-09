"use client";

import { BalloonValley } from "@/components/asciicn/balloon-valley";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/balloon-valley-controls";

export default function BalloonValleyDemo() {
  return (
    <BalloonValley
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      square={usePreviewValue(knobs.square)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
