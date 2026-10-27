"use client";

import { OrreryScene } from "@/components/asciicn/scenes/orrery-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/orrery-scene-controls";
import { CRT_FX } from "@/lib/ascii";

export default function OrrerySceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);
  return (
    <OrreryScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      fx={crt ? CRT_FX : undefined}
      tilt={usePreviewValue(knobs.tilt)}
      glow={usePreviewValue(knobs.glow)}
      engraving={usePreviewValue(knobs.engraving)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
