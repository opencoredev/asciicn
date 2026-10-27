"use client";

import { CyberpunkRainScene } from "@/components/asciicn/scenes/cyberpunk-rain-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/cyberpunk-rain-scene-controls";
import { CRT_FX } from "@/lib/ascii";

export default function CyberpunkRainSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);
  return (
    <CyberpunkRainScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      fx={crt ? CRT_FX : undefined}
      rain={usePreviewValue(knobs.rain)}
      wind={usePreviewValue(knobs.wind)}
      fog={usePreviewValue(knobs.fog)}
      signs={usePreviewValue(knobs.signs)}
      glitch={usePreviewValue(knobs.glitch)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
