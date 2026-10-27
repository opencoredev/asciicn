"use client";

import { Matrix } from "@/components/asciicn/matrix";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/matrix-controls";

export default function MatrixDemo() {
  return (
    <Matrix
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      color={usePreviewValue(knobs.rain)}
      density={usePreviewValue(knobs.density)}
      length={usePreviewValue(knobs.length)}
      mutation={usePreviewValue(knobs.mutation)}
      depth={usePreviewValue(knobs.depth)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
