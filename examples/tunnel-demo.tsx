"use client";

import { Tunnel } from "@/components/asciicn/tunnel";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/tunnel-controls";

export default function TunnelDemo() {
  return (
    <Tunnel
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      farColor={usePreviewValue(knobs.far)}
      shape={usePreviewValue(knobs.shape)}
      rings={usePreviewValue(knobs.rings)}
      spokes={usePreviewValue(knobs.spokes)}
      fog={usePreviewValue(knobs.fog)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
