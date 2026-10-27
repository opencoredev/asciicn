"use client";

import { WovenBannerScene } from "@/components/asciicn/scenes/woven-banner-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/woven-banner-scene-controls";

export default function WovenBannerSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);

  return (
    <WovenBannerScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      text={usePreviewValue(knobs.text)}
      colors={knobs.DYES[usePreviewValue(knobs.dye)]}
      wind={usePreviewValue(knobs.wind)}
      gusts={usePreviewValue(knobs.gusts)}
      streaks={usePreviewValue(knobs.streaks)}
      fx={crt ? undefined : {}}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
