"use client";

import { Silk } from "@/components/asciicn/silk";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/silk-controls";

export default function SilkDemo() {
  return (
    <Silk
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      shadeColor={usePreviewValue(knobs.shade)}
      folds={usePreviewValue(knobs.folds)}
      angle={usePreviewValue(knobs.angle)}
      sheen={usePreviewValue(knobs.sheen)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
