"use client";

import { NewYork } from "@/components/asciicn/new-york";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/new-york-controls";

export default function NewYorkDemo() {
  return (
    <NewYork
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      intensity={usePreviewValue(knobs.intensity)}
      windows={usePreviewValue(knobs.windows)}
      ferry={usePreviewValue(knobs.ferry)}
      cell={usePreviewValue(knobs.cell)}
      square={usePreviewValue(knobs.square)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
