"use client";

import { MeshGradient } from "@/components/asciicn/mesh-gradient";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/mesh-gradient-controls";

export default function MeshGradientDemo() {
  return (
    <MeshGradient
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      blobs={usePreviewValue(knobs.blobs)}
      size={usePreviewValue(knobs.size)}
      warp={usePreviewValue(knobs.warp)}
      contrast={usePreviewValue(knobs.contrast)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
