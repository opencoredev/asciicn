"use client";

import { Contours } from "@/components/asciicn/contours";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/contours-controls";

export default function ContoursDemo() {
  return (
    <Contours
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      lines={usePreviewValue(knobs.lines)}
      index={usePreviewValue(knobs.index)}
      relief={usePreviewValue(knobs.relief)}
      weight={usePreviewValue(knobs.weight)}
      scale={usePreviewValue(knobs.scale)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
