"use client";

import { Smoke } from "@/components/asciicn/smoke";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/smoke-controls";

export default function SmokeDemo() {
  return (
    <Smoke
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      shadowColor={usePreviewValue(knobs.shadow)}
      scale={usePreviewValue(knobs.scale)}
      height={usePreviewValue(knobs.height)}
      wind={usePreviewValue(knobs.wind)}
      density={usePreviewValue(knobs.density)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
