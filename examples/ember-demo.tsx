"use client";

import { Ember } from "@/components/asciicn/ember";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ember-controls";

export default function EmberDemo() {
  return (
    <Ember
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      wind={usePreviewValue(knobs.wind)}
      sparks={usePreviewValue(knobs.sparks)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      className="absolute inset-0"
    />
  );
}
