"use client";

import { TorusKnot } from "@/components/asciicn/torus-knot";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/torus-knot-controls";

export default function TorusKnotDemo() {
  return (
    <TorusKnot
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ramp={usePreviewValue(knobs.ramp)}
      p={usePreviewValue(knobs.p)}
      q={usePreviewValue(knobs.q)}
      thickness={usePreviewValue(knobs.thickness)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      contours={usePreviewValue(knobs.contours)}
      className="absolute inset-0"
    />
  );
}
