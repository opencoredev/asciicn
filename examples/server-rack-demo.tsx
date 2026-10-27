"use client";

import { ServerRack } from "@/components/asciicn/server-rack";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/server-rack-controls";

export default function ServerRackDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <ServerRack
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      units={usePreviewValue(knobs.units)}
      activity={usePreviewValue(knobs.activity)}
      alert={usePreviewValue(knobs.alert)}
      intensity={usePreviewValue(knobs.intensity)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
