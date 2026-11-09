"use client";

import { GlacierLagoon } from "@/components/asciicn/glacier-lagoon";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/glacier-lagoon-controls";

export default function GlacierLagoonDemo() {
  return (
    <GlacierLagoon
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      mist={usePreviewValue(knobs.mist)}
      cell={usePreviewValue(knobs.cell)}
      square={usePreviewValue(knobs.square)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
