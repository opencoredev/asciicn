"use client";

import { Tokyo } from "@/components/asciicn/tokyo";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/tokyo-controls";

export default function TokyoDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <Tokyo
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      neon={usePreviewValue(knobs.neon)}
      traffic={usePreviewValue(knobs.traffic)}
      fuji={usePreviewValue(knobs.fuji)}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
