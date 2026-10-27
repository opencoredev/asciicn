"use client";

import { AbyssalJellyfishScene } from "@/components/asciicn/scenes/abyssal-jellyfish-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/abyssal-jellyfish-scene-controls";
import { CRT_FX } from "@/lib/ascii";

export default function AbyssalJellyfishSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const ramp = usePreviewValue(knobs.ramp);
  const crt = usePreviewValue(knobs.crt);
  return (
    <AbyssalJellyfishScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={ramp}
      fx={crt ? CRT_FX : undefined}
      jellies={usePreviewValue(knobs.jellies)}
      size={usePreviewValue(knobs.size)}
      tentacles={usePreviewValue(knobs.tentacles)}
      hue={usePreviewValue(knobs.hue)}
      rays={usePreviewValue(knobs.rays)}
      bubbles={usePreviewValue(knobs.bubbles)}
      snow={usePreviewValue(knobs.snow)}
      push={usePreviewValue(knobs.push)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
