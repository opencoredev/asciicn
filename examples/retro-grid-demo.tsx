"use client";

import { RetroGrid } from "@/components/asciicn/retro-grid";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/retro-grid-controls";

export default function RetroGridDemo() {
  return (
    <RetroGrid
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      sunColor={usePreviewValue(knobs.sunColor)}
      horizon={usePreviewValue(knobs.horizon)}
      sun={usePreviewValue(knobs.sun)}
      columns={usePreviewValue(knobs.columns)}
      slits={usePreviewValue(knobs.slits)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
