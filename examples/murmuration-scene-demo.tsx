"use client";

import { MurmurationScene } from "@/components/asciicn/scenes/murmuration-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/murmuration-scene-controls";

export default function MurmurationSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);

  return (
    <MurmurationScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      birds={usePreviewValue(knobs.birds)}
      cohesion={usePreviewValue(knobs.cohesion)}
      fold={usePreviewValue(knobs.fold)}
      horizon={usePreviewValue(knobs.horizon)}
      hawk={usePreviewValue(knobs.hawk)}
      fx={crt ? undefined : {}}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
