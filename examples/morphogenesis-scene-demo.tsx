"use client";

import { MorphogenesisScene } from "@/components/asciicn/scenes/morphogenesis-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/morphogenesis-scene-controls";

export default function MorphogenesisSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);

  return (
    <MorphogenesisScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      pattern={usePreviewValue(knobs.pattern)}
      growth={usePreviewValue(knobs.growth)}
      drift={usePreviewValue(knobs.drift)}
      scale={usePreviewValue(knobs.scale)}
      fx={crt ? undefined : {}}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
