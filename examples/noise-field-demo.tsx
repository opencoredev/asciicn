"use client";

import { NoiseField } from "@/components/asciicn/noise-field";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/noise-field-controls";

export default function NoiseFieldDemo() {
  return (
    <NoiseField
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      variant={usePreviewValue(knobs.variant)}
      scale={usePreviewValue(knobs.scale)}
      warp={usePreviewValue(knobs.warp)}
      detail={usePreviewValue(knobs.detail)}
      contrast={usePreviewValue(knobs.contrast)}
      mask={usePreviewValue(knobs.mask)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
