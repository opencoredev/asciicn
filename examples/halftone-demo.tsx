"use client";

import { Halftone } from "@/components/asciicn/halftone";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/halftone-controls";

export default function HalftoneDemo() {
  return (
    <Halftone
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      source={usePreviewValue(knobs.source)}
      pitch={usePreviewValue(knobs.pitch)}
      angle={usePreviewValue(knobs.angle)}
      intensity={usePreviewValue(knobs.intensity)}
      drift={usePreviewValue(knobs.drift)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
