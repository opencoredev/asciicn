"use client";

import { BlackHole } from "@/components/asciicn/black-hole";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/black-hole-controls";

export default function BlackHoleDemo() {
  return (
    <BlackHole
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      tint={usePreviewValue(knobs.tint)}
      tilt={usePreviewValue(knobs.tilt)}
      diskSize={usePreviewValue(knobs.diskSize)}
      beaming={usePreviewValue(knobs.beaming)}
      speed={usePreviewValue(knobs.speed)}
      stars={usePreviewValue(knobs.stars)}
      cell={usePreviewValue(knobs.cell)}
      className="absolute inset-0"
    />
  );
}
